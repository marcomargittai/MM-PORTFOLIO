#!/usr/bin/env python3
"""Tiny login-item gate for MM Life.

Listens on 43173. Starts Next only when something opens that URL.
Stops Next after IDLE_SEC with no traffic so it is not sitting on 8GB RAM.
The gate itself is one idle Python process.
"""

from __future__ import annotations

import os
import select
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request

GATE_HOST = "127.0.0.1"
GATE_PORT = int(os.environ.get("MM_LIFE_GATE_PORT", "43173"))
NEXT_HOST = "127.0.0.1"
NEXT_PORT = int(os.environ.get("MM_LIFE_NEXT_PORT", "43174"))
IDLE_SEC = int(os.environ.get("MM_LIFE_IDLE_SEC", "600"))
ROOT = os.environ.get("MM_LIFE_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NPM = os.environ.get("MM_LIFE_NPM") or shutil.which("npm") or "npm"

lock = threading.Lock()
child: subprocess.Popen[bytes] | None = None
last_hit = 0.0


def log(msg: str) -> None:
    print(time.strftime("%H:%M:%S"), msg, flush=True)


def next_up() -> bool:
    try:
        with urllib.request.urlopen(f"http://{NEXT_HOST}:{NEXT_PORT}/", timeout=0.4) as res:
            return 200 <= res.status < 500
    except (urllib.error.URLError, TimeoutError, ConnectionError, OSError):
        return False


def start_next() -> None:
    global child, last_hit
    with lock:
        last_hit = time.time()
        if child is not None and child.poll() is None and next_up():
            return
        if child is not None and child.poll() is None:
            return
        log("waking Next")
        env = os.environ.copy()
        child = subprocess.Popen(
            [NPM, "run", "dev", "--", "-p", str(NEXT_PORT), "-H", NEXT_HOST],
            cwd=ROOT,
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
    deadline = time.time() + 40
    while time.time() < deadline:
        if next_up():
            log("Next is up")
            return
        if child is not None and child.poll() is not None:
            log(f"Next exited {child.returncode}")
            return
        time.sleep(0.25)
    log("Next did not become ready")


def stop_next() -> None:
    global child
    with lock:
        proc = child
        child = None
    if proc is None or proc.poll() is not None:
        return
    log("sleeping Next")
    try:
        os.killpg(proc.pid, 15)
    except ProcessLookupError:
        return
    try:
        proc.wait(timeout=8)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(proc.pid, 9)
        except ProcessLookupError:
            pass


def idle_watch() -> None:
    while True:
        time.sleep(15)
        with lock:
            idle = time.time() - last_hit
            alive = child is not None and child.poll() is None
        if alive and idle >= IDLE_SEC:
            stop_next()


def pipe(src: socket.socket, dst: socket.socket) -> None:
    try:
        while True:
            data = src.recv(65536)
            if not data:
                break
            dst.sendall(data)
    except OSError:
        pass
    finally:
        try:
            dst.shutdown(socket.SHUT_WR)
        except OSError:
            pass


def handle(client: socket.socket) -> None:
    global last_hit
    last_hit = time.time()
    start_next()
    if not next_up():
        client.close()
        return
    try:
        upstream = socket.create_connection((NEXT_HOST, NEXT_PORT), timeout=8)
    except OSError:
        client.close()
        return
    last_hit = time.time()
    a = threading.Thread(target=pipe, args=(client, upstream), daemon=True)
    b = threading.Thread(target=pipe, args=(upstream, client), daemon=True)
    a.start()
    b.start()
    a.join()
    b.join()
    last_hit = time.time()
    try:
        client.close()
    except OSError:
        pass
    try:
        upstream.close()
    except OSError:
        pass


def serve() -> None:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((GATE_HOST, GATE_PORT))
    sock.listen(32)
    sock.setblocking(False)
    log(f"gate on http://{GATE_HOST}:{GATE_PORT} → Next :{NEXT_PORT}, idle {IDLE_SEC}s")
    threading.Thread(target=idle_watch, daemon=True).start()
    try:
        while True:
            ready, _, _ = select.select([sock], [], [], 1.0)
            if not ready:
                continue
            client, _ = sock.accept()
            client.setblocking(True)
            threading.Thread(target=handle, args=(client,), daemon=True).start()
    except KeyboardInterrupt:
        pass
    finally:
        stop_next()
        sock.close()


if __name__ == "__main__":
    if not os.path.isdir(ROOT):
        sys.exit(f"missing repo {ROOT}")
    serve()

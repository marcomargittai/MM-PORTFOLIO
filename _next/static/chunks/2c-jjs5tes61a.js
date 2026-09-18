(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,76323,e=>{e.v({className:"instrument_sans_5d9b0dfb-module__7uQ3xW__className"})},72433,e=>{e.v({className:"instrument_serif_4335e1f6-module__1CRdaq__className"})},81524,e=>{"use strict";var t=e.i(43476),i=e.i(72433);let r={className:i.default.className,style:{fontFamily:"'Instrument Serif', 'Instrument Serif Fallback'",fontWeight:400,fontStyle:"italic"}};null!=i.default.variable&&(r.variable=i.default.variable);var o=e.i(76323);let l={className:o.default.className,style:{fontFamily:"'Instrument Sans', 'Instrument Sans Fallback'",fontStyle:"normal"}};null!=o.default.variable&&(l.variable=o.default.variable);var a=e.i(71645);function n(e,t){return(e%=t)<0?e+t:e}class s{width;height;cells;generation=0;next;constructor(e,t){if(!Number.isInteger(e)||!Number.isInteger(t)||e<1||t<1)throw RangeError("LifeEngine width/height must be positive integers");this.width=e,this.height=t,this.cells=new Uint8Array(e*t),this.next=new Uint8Array(e*t)}index(e,t){return n(t,this.height)*this.width+n(e,this.width)}get(e,t){return this.cells[this.index(e,t)]}set(e,t,i){this.cells[this.index(e,t)]=i}toggle(e,t){let i=this.index(e,t),r=1^this.cells[i];return this.cells[i]=r,r}stampPattern(e,t=0,i=0){let r=this.width,o=this.height,l=this.cells,a=e.length;for(let s=0;s<a;s++){let[a,u]=e[s],h=n(t+a,r);l[n(i+u,o)*r+h]=1}}liveCount(){let e=0,t=this.cells;for(let i=0;i<t.length;i++)e+=t[i];return e}clear(){this.cells.fill(0),this.next.fill(0),this.generation=0}randomize(e=.12){let t=e<0?0:e>1?1:e;this.cells.fill(0);let i=16+Math.floor(10*Math.random());for(let e=0;e<i;e++){let e=Math.floor(Math.random()*this.width),i=Math.floor(Math.random()*this.height),r=3+Math.floor(4*Math.random());for(let o=0;o<r;o++)for(let l=0;l<r;l++)Math.random()<3*t&&this.set(e+l,i+o,1)}let r=8+Math.floor(8*Math.random());for(let e=0;e<r;e++)this.set(Math.floor(Math.random()*this.width),Math.floor(Math.random()*this.height),1);this.next.fill(0),this.generation=0}paintLine(e,t,i,r,o=1){e|=0,t|=0,i|=0,r|=0;let l=Math.abs(i-e),a=e<i?1:-1,n=-Math.abs(r-t),s=t<r?1:-1,u=l+n,h=e,c=t;for(;this.set(h,c,o),h!==i||c!==r;){let e=u<<1;e>=n&&(u+=n,h+=a),e<=l&&(u+=l,c+=s)}}step(){let e=this.width,t=this.height,i=this.cells,r=this.next;for(let o=0;o<t;o++){let l=o*e,a=0===o?(t-1)*e:l-e,n=o===t-1?0:l+e;for(let t=0;t<e;t++){let o=0===t?e-1:t-1,s=t===e-1?0:t+1,u=i[a+o]+i[a+t]+i[a+s]+i[l+o]+i[l+s]+i[n+o]+i[n+t]+i[n+s],h=i[l+t];r[l+t]=+(3===u||0!==h&&2===u)}}this.cells=r,this.next=i,this.generation+=1}resize(e,t){if(!Number.isInteger(e)||!Number.isInteger(t)||e<1||t<1)throw RangeError("LifeEngine width/height must be positive integers");if(e===this.width&&t===this.height)return;let i=new Uint8Array(e*t),r=Math.min(this.width,e),o=Math.min(this.height,t),l=Math.max(0,this.width-e>>1),a=Math.max(0,this.height-t>>1),n=Math.max(0,e-this.width>>1),s=Math.max(0,t-this.height>>1),u=this.cells,h=this.width;for(let t=0;t<o;t++){let o=(a+t)*h+l;i.set(u.subarray(o,o+r),(s+t)*e+n)}this.width=e,this.height=t,this.cells=i,this.next=new Uint8Array(e*t)}}let u=1/24,h=1/30;class c{engine;playing=!1;speed;maxStepsPerFrame;maxDelta;blend=1;previous;onFrame;isBusy;rafId=null;lastTime=0;running=!1;morphing=!1;settleRate=0;restStroke=!1;queuedStep=!1;idleFrames=0;constructor(e){this.engine=e.engine,this.speed=e.speed??12,this.maxStepsPerFrame=e.maxStepsPerFrame??2,this.maxDelta=e.maxDelta??.25,this.onFrame=e.onFrame,this.isBusy=e.isBusy,this.previous=new Uint8Array(e.engine.cells)}get settling(){return this.morphing}get morphDuration(){return this.playing?1/Math.max(this.speed,.25):this.restStroke?.36:this.morphing&&this.settleRate>0?Math.max(1-this.blend,1e-4)/this.settleRate:this.morphing?.34:1/Math.max(this.speed,.25)}setSpeed(e){Number.isFinite(e)&&(this.speed=Math.max(.25,e))}play(){this.playing=!0,this.morphing=!1,this.restStroke=!1,this.start()}pause(){if(this.playing=!1,this.queuedStep=!1,this.restStroke=!1,Number.isFinite(this.blend)&&this.blend<.9999){this.morphing=!0,this.easeRemaining(.42),this.start();return}this.ensurePrev(),this.previous.set(this.engine.cells),this.blend=1,this.morphing=!1}togglePlaying(){this.playing?this.pause():this.play()}stepOnce(){this.snapshot(),this.engine.step(),this.blend=0,this.morphing=!0,this.restStroke=!1,this.queuedStep=!1,this.settleRate=2.941176470588235,this.start()}align(){this.ensurePrev(),this.previous.set(this.engine.cells),this.blend=1,this.morphing=!1,this.restStroke=!1,this.queuedStep=!1}beginStroke(){this.playing=!1,this.queuedStep=!1,this.ensurePrev(),this.restStroke=!1,(this.blend<.9999||this.morphing)&&(this.morphing=!0,this.easeRemaining(.42)),this.start()}stamp(e,t,i){this.ensurePrev(),this.playing=!1;let r=this.engine.index(e,t);this.engine.cells[r]=i,this.previous[r]=i,this.blend>=.9999&&!this.morphing?(this.blend=1,this.morphing=!1,this.restStroke=!1):(this.morphing=!0,this.settleRate<=0&&this.easeRemaining(.42)),this.start()}stampLine(e,t,i,r,o){e|=0,t|=0,i|=0,r|=0;let l=Math.abs(i-e),a=e<i?1:-1,n=-Math.abs(r-t),s=t<r?1:-1,u=l+n,h=e,c=t;for(;this.stamp(h,c,o),h!==i||c!==r;){let e=u<<1;e>=n&&(u+=n,h+=a),e<=l&&(u+=l,c+=s)}}start(){this.idleFrames=0,this.running||"function"==typeof requestAnimationFrame&&(this.running=!0,this.lastTime=performance.now(),this.rafId=requestAnimationFrame(this.frame))}nudge(){this.idleFrames=0,this.start()}stop(){this.playing=!1,this.running=!1,null!==this.rafId&&(cancelAnimationFrame(this.rafId),this.rafId=null)}tick(e){let t=this.applyTime(e);return this.emit(e,t)}ensurePrev(){this.previous.length!==this.engine.cells.length&&(this.previous=new Uint8Array(this.engine.cells))}snapshot(){this.ensurePrev(),this.previous.set(this.engine.cells)}easeRemaining(e){let t=Math.max(1-this.blend,1e-4);this.settleRate=t/Math.max(e,.001)}applyTime(e){let t=0;if(this.ensurePrev(),this.playing&&this.speed>0){let i=Math.min(e,h);if(this.queuedStep)return this.snapshot(),this.engine.step(),this.blend=0,this.queuedStep=!1,t=1;this.blend+=i*this.speed,this.blend>=1&&(this.blend=1,this.queuedStep=!0)}else if(this.morphing){let t=this.settleRate>0?this.settleRate:2.380952380952381;this.blend+=Math.min(e,u)*t,this.blend>=1&&(this.blend=1,this.morphing=!1,this.restStroke=!1,this.previous.set(this.engine.cells))}return t}emit(e,t){let i=this.blend<0?0:this.blend>1?1:this.blend,r={dt:e,steps:t,playing:this.playing,generation:this.engine.generation,blend:i,morphDuration:this.morphDuration,previous:this.previous,current:this.engine.cells};return this.onFrame?.(r),r}frame=e=>{if(!this.running)return;let t=(e-this.lastTime)/1e3;this.lastTime=e;let i=t>this.maxDelta?this.maxDelta:t<0?0:t,r=this.applyTime(i);if(this.emit(i,r),this.playing||this.morphing||this.queuedStep||this.isBusy?.()===!0)this.idleFrames=0;else if(this.idleFrames+=1,this.idleFrames>10){this.running=!1,this.rafId=null;return}this.rafId=requestAnimationFrame(this.frame)}}function d(e){let t=e.replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n").map(e=>e.trim()).filter(e=>e.length>0&&!e.startsWith("#")&&!/^x\s*=/i.test(e)).join(""),i=[],r=0,o=0,l=0;for(;l<t.length;){let e=t[l];if("!"===e)break;if(/\s/.test(e)){l+=1;continue}let a=0;for(;l<t.length&&t[l]>="0"&&t[l]<="9";)a=10*a+(t[l].charCodeAt(0)-48),l+=1;let n=0===a?1:a;if(l>=t.length)break;let s=t[l];if(l+=1,"!"===s)break;if("$"===s){o+=n,r=0;continue}if("b"===s||"B"===s||"."===s){r+=n;continue}for(let e=0;e<n;e+=1)i.push([r,o]),r+=1}return f(i)}function f(e){if(0===e.length)return{width:0,height:0,cells:[]};let t=1/0,i=1/0,r=-1/0,o=-1/0;for(let[l,a]of e)l<t&&(t=l),a<i&&(i=a),l>r&&(r=l),a>o&&(o=a);let l=0===t&&0===i?[...e]:e.map(([e,r])=>[e-t,r-i]);return{width:r-t+1,height:o-i+1,cells:l}}let p={block:"x = 2, y = 2, rule = B3/S23\n2o$2o!",beehive:"x = 4, y = 3, rule = B3/S23\nb2o$o2bo$b2o!",loaf:"x = 4, y = 4, rule = B3/S23\nb2o$o2bo$bobo$2bo!",tub:"x = 3, y = 3, rule = B3/S23\nbo$obo$bo!",blinker:"x = 3, y = 1, rule = B3/S23\n3o!",toad:"x = 4, y = 2, rule = B3/S23\nb3o$3o!",beacon:"x = 4, y = 4, rule = B3/S23\n2o$o$3bo$2b2o!",clock:"x = 4, y = 4, rule = B3/S23\n2bo$obo$bobo$bo!",pulsar:`x = 13, y = 13, rule = B3/S23
2b3o3b3o2$o4bobo4bo$o4bobo4bo$o4bobo4bo$2b3o3b3o2$2b3o3b3o$o4bobo4bo$o4bobo4bo$o4bobo4bo2$2b3o3b3o!`,figureEight:`x = 6, y = 6, rule = B3/S23
2o$2obo$4bo$bo$2bob2o$4b2o!`,koksGalaxy:`x = 9, y = 9, rule = B3/S23
2bo2bobo$2obob3o$bo6bo$2o5bo2$bo5b2o$o6bo$b3obob2o$bobo2bo!`,tumbler:`x = 9, y = 5, rule = B3/S23
bo5bo$obo3bobo$o2bobo2bo$2bo3bo$2b2ob2o!`,pentadecathlon:`x = 10, y = 3, rule = B3/S23
2bo4bo$2ob4ob2o$2bo4bo!`,queenBee:`x = 22, y = 7, rule = B3/S23
9bo$7bobo$6bobo$2o3bo2bo11b2o$2o4bobo11b2o$7bobo$9bo!`,twinBees:`x = 29, y = 11, rule = B3/S23
17b2o$2o15bobo7b2o$2o17bo7b2o$17b3o4$17b3o$2o17bo$2o15bobo$17b2o!`,glider:"x = 3, y = 3, rule = B3/S23\nbo$2bo$3o!",lwss:"x = 5, y = 4, rule = B3/S23\nbo2bo$o$o3bo$4o!",mwss:"x = 6, y = 5, rule = B3/S23\n3bo$bo3bo$o$o4bo$5o!",hwss:"x = 7, y = 5, rule = B3/S23\n3b2o$bo4bo$o$o5bo$6o!",loafer:`x = 9, y = 9, rule = B3/S23
b2o2bob2o$o2bo2b2o$bobo$2bo$8bo$6b3o$5bo$6bo$7b2o!`,copperhead:`x = 8, y = 12, rule = B3/S23
b2o2b2o$3b2o$3b2o$obo2bobo$o6bo2$o6bo$b2o2b2o$2b4o2$3b2o$3b2o!`,weekender:`x = 16, y = 11, rule = B3/S23
bo12bo$bo12bo$obo10bobo$bo12bo$bo12bo$2bo3b4o3bo$6b4o$2b4o4b4o2$4bo6bo$5b2o2b2o!`,gosper:`x = 36, y = 9, rule = B3/S23
24bo$22bobo$12b2o6b2o12b2o$11bo3bo4b2o12b2o$2o8bo5bo3b2o$2o8bo3bob2o4bobo$10bo5bo7bo$11bo3bo$12b2o!`,simkin:`x = 33, y = 14, rule = B3/S23
2o5b2o$2o5b2o2$4b2o$4b2o5$22b2ob2o$21bo5bo$21bo6bo2b2o$21b3o3bo3b2o$26bo!`,rpentomino:"x = 3, y = 3, rule = B3/S23\nb2o$2o$bo!",diehard:"x = 8, y = 3, rule = B3/S23\n6bo$2o$bo3b3o!",acorn:"x = 7, y = 3, rule = B3/S23\nbo$3bo$2o2b3o!",rabbits:"x = 7, y = 3, rule = B3/S23\no3b3o$3o2bo$bo!",switchEngine:"x = 6, y = 4, rule = B3/S23\nbobo$o$bo2bo$3b3o!",puffer1:`x = 27, y = 7, rule = B3/S23
b3o6bo5bo6b3o$o2bo5b3o3b3o5bo2bo$3bo4b2obo3bob2o4bo$3bo19bo$3bo2bo13bo2bo$3bo2b2o11b2o2bo$2bo3b2o11b2o3bo!`,puffer2:`x = 18, y = 5, rule = B3/S23
b3o11b3o$o2bo10bo2bo$3bo4b3o6bo$3bo4bo2bo5bo$2bo4bo8bo!`,dart:`x = 15, y = 10, rule = B3/S23
7bo$6bobo$5bo3bo$6b3o2$4b2o3b2o$2bo3bobo3bo$b2o3bobo3b2o$o5bobo5bo$bob2obobob2obo!`,pufferfish:`x = 15, y = 12, rule = B3/S23
3bo7bo$2b3o5b3o$b2o2bo3bo2b2o$3b3o3b3o2$4bo5bo$2bo2bo3bo2bo$o5bobo5bo$2o4bobo4b2o$6bobo$3bobo3bobo$4bo5bo!`,thunderbird:"x = 3, y = 5, rule = B3/S23\n3o2$bo$bo$bo!",bheptomino:"x = 4, y = 3, rule = B3/S23\nob2o$3o$bo!",piheptomino:"x = 3, y = 3, rule = B3/S23\n3o$obo$obo!",smiley:`x = 7, y = 7, rule = B3/S23
3ob3o$bobobo2$bo3bo2$obobobo$2bobo!`,achimsP16:`x = 13, y = 13, rule = B3/S23
6b2o$6bobo$bo4bob2o$2o5bo$o2bo$3o2$10b3o$9bo2bo$4bo5b2o$2b2obo4bo$3bobo$4b2o!`,unix:`x = 8, y = 8, rule = B3/S23
b2o$b2o2$bo$obo$o2bo2b2o$4bob2o$2b2o!`,pinwheel:`x = 12, y = 12, rule = B3/S23
6b2o$6b2o2$4b4o$2obo4bo$2obo2bobo$3bo3b2ob2o$3bobo2bob2o$4b4o2$4b2o$4b2o!`},m=[{id:"gosper-glider-gun",name:"The Gun",category:"gun",period:30,featured:!0,description:"Two queen bees arguing forever, throwing a glider into the dark every thirty ticks.",rle:p.gosper},{id:"simkin-glider-gun",name:"Simkin Gun",category:"gun",period:120,featured:!0,description:"A compact Herschel loop with two barrels — Life’s smallest double stream.",rle:p.simkin},{id:"pulsar",name:"Pulsar",category:"oscillator",period:3,featured:!0,description:"A twelve-armed star that inhales and exhales every three heartbeats.",rle:p.pulsar},{id:"pentadecathlon",name:"Pentadecathlon",category:"oscillator",period:15,featured:!0,description:"A bar that learned to juggle itself through fifteen shapes.",rle:p.pentadecathlon},{id:"koks-galaxy",name:"Kok’s Galaxy",category:"oscillator",period:8,featured:!0,description:"A pinwheel of eight-fold fire, flinging sparks from every corner.",rle:p.koksGalaxy},{id:"acorn",name:"Acorn",category:"methuselah",featured:!0,description:"Seven quiet seeds that wait, then forest a whole board.",rle:p.acorn},{id:"r-pentomino",name:"R-Pentomino",category:"methuselah",featured:!0,description:"Five cells that refuse to settle — an 1103-generation opera.",rle:p.rpentomino},{id:"copperhead",name:"Copperhead",category:"spaceship",period:10,featured:!0,description:"A stubby snake of a ship, inching upward like a coin on its edge.",rle:p.copperhead},{id:"weekender",name:"Weekender",category:"spaceship",period:7,featured:!0,description:"A wide, winged thing that lurches two cells every weekend of seven ticks.",rle:p.weekender},{id:"fleet",name:"The Fleet",category:"setup",period:4,featured:!0,description:"Lightweight, middleweight, and heavyweight — a navy planing west.",parts:[{rle:p.hwss,x:0,y:0},{rle:p.mwss,x:2,y:8},{rle:p.lwss,x:4,y:16}]},{id:"queen-bee-shuttle",name:"Queen Bee",category:"oscillator",period:30,featured:!0,description:"A honeybee of cells ferrying between two blocks, sparking the void.",rle:p.queenBee},{id:"diehard",name:"Diehard",category:"methuselah",featured:!0,description:"Seven cells with a death wish, vanishing without a trace on tick 130.",rle:p.diehard},{id:"pufferfish",name:"Pufferfish",category:"puffer",period:12,featured:!0,description:"A nearly-natural engine that drops pairs of blocks in its wake.",rle:p.pufferfish},{id:"dart",name:"Dart",category:"spaceship",period:3,featured:!0,description:"A pointed c/3 hull, nose first, cutting a clean line through the field.",rle:p.dart},{id:"garden",name:"Garden",category:"setup",featured:!0,description:"A composed print: pulsar, pentadecathlon, galaxy, and a few still lives.",parts:[{rle:p.pulsar,x:0,y:0},{rle:p.pentadecathlon,x:20,y:5},{rle:p.koksGalaxy,x:20,y:16},{rle:p.beehive,x:0,y:18},{rle:p.loaf,x:6,y:18},{rle:p.block,x:12,y:19}]},{id:"glider",name:"Glider",category:"spaceship",period:4,featured:!0,description:"The smallest traveler: a five-cell kite that walks forever.",rle:p.glider},{id:"glider-squadron",name:"Squadron",category:"setup",period:4,featured:!0,description:"Four gliders in a loose diagonal — the Life logo, set in motion.",parts:[{rle:p.glider,x:0,y:0},{rle:p.glider,x:8,y:6},{rle:p.glider,x:16,y:12},{rle:p.glider,x:24,y:18}]},{id:"rabbits",name:"Rabbits",category:"methuselah",featured:!0,description:"Nine cells that breed a long chaos before the field finally goes still.",rle:p.rabbits},{id:"switch-engine",name:"Switch Engine",category:"methuselah",featured:!0,description:"Corderman’s diagonal ghost — eight cells copying themselves into exhaust.",rle:p.switchEngine},{id:"twin-bees-shuttle",name:"Twin Bees",category:"oscillator",period:46,featured:!0,description:"A pair of B-heptominoes slamming sparks between distant blocks.",rle:p.twinBees},{id:"loafer",name:"Loafer",category:"spaceship",period:7,featured:!0,description:"A tiny c/7 walker, loaf-like and unhurried, padding as if it had all day.",rle:p.loafer},{id:"puffer-2",name:"Puffer 2",category:"puffer",period:140,featured:!0,description:"Two lightweight escorts dragging a B-heptomino that never stops littering.",rle:p.puffer2},{id:"figure-eight",name:"Figure Eight",category:"oscillator",period:8,description:"Two blocks that learned to tumble around each other like a knotted beacon.",rle:p.figureEight},{id:"tumbler",name:"Tumbler",category:"oscillator",period:14,description:"A gymnast of sixteen cells, flipping for fourteen ticks and never falling.",rle:p.tumbler},{id:"smiley",name:"Smiley",category:"oscillator",period:8,description:"A compact face that blinks — found in a soup, kept as a joke that works.",rle:p.smiley},{id:"achims-p16",name:"Achim’s p16",category:"oscillator",period:16,description:"A rotating, pulsing core that takes sixteen beats to remember itself.",rle:p.achimsP16},{id:"pinwheel",name:"Pinwheel",category:"oscillator",period:4,description:"A period-4 rotor held by four blocks, turning in place since 1970.",rle:p.pinwheel},{id:"unix",name:"Unix",category:"oscillator",period:6,description:"The smallest period-6 oscillator — two blocks eating a long barge.",rle:p.unix},{id:"lightweight-spaceship",name:"Lightweight",category:"spaceship",period:4,description:"A nine-cell hull planing west at half lightspeed.",rle:p.lwss},{id:"middleweight-spaceship",name:"Middleweight",category:"spaceship",period:4,description:"The middle sibling, one spark heavier, still skimming like a thrown blade.",rle:p.mwss},{id:"heavyweight-spaceship",name:"Heavyweight",category:"spaceship",period:4,description:"The big brother of the fleet: a six-wide prow throwing a white wake.",rle:p.hwss},{id:"puffer-1",name:"Puffer 1",category:"puffer",period:128,description:"Gosper’s first dirty engine — two ships dragging wreckage through the void.",rle:p.puffer1},{id:"thunderbird",name:"Thunderbird",category:"methuselah",description:"A T of five cells that blooms, then settles into a small still garden.",rle:p.thunderbird},{id:"b-heptomino",name:"B-Heptomino",category:"methuselah",description:"The restless seven that starts so many engines.",rle:p.bheptomino},{id:"pi-heptomino",name:"Pi-Heptomino",category:"methuselah",description:"A pi of seven cells — the other famous spark of chaos.",rle:p.piheptomino},{id:"blinker",name:"Blinker",category:"oscillator",period:2,description:"Three cells that cannot choose a direction.",rle:p.blinker},{id:"toad",name:"Toad",category:"oscillator",period:2,description:"Two triples breathing against each other.",rle:p.toad},{id:"beacon",name:"Beacon",category:"oscillator",period:2,description:"Two blocks taking turns remembering the other is there.",rle:p.beacon},{id:"clock",name:"Clock",category:"oscillator",period:2,description:"Six cells turning the smallest hour-hand Life ever wound.",rle:p.clock},{id:"block",name:"Block",category:"still-life",period:1,description:"Four cells in a square that have already arrived at forever.",rle:p.block},{id:"beehive",name:"Beehive",category:"still-life",period:1,description:"Six cells curled into a honeycomb.",rle:p.beehive},{id:"loaf",name:"Loaf",category:"still-life",period:1,description:"A seven-cell bun, content to sit and be bread.",rle:p.loaf}];function b(e){if(e.parts?.length){var t=e.parts.map(e=>({cells:d(e.rle).cells,ox:e.x,oy:e.y}));let i=[];for(let e of t)for(let[t,r]of e.cells)i.push([t+e.ox,r+e.oy]);return f(i)}return e.rle?d(e.rle):{width:0,height:0,cells:[]}}function g(e){return m.find(t=>t.id===e)}let x="mm-life-wiggle";function v(){let e=window.localStorage.getItem(x);return null!=e&&("1"===e||"on"===e||"true"===e)}function y(e,t,i=1/12){if(t<=0)return 0;let r=e<0?0:e>1?1:e;if(r<=0||r>=1-1e-6)return 0;let o=1-r;return 16*r*r*o*o*.3*Math.sin(2*Math.PI*(1+1.5*Math.max(i,.001))*r)}let w=1/9,S=`#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`,$=`#version 300 es
precision highp float;

uniform sampler2D uGrid;
uniform vec2 uGridSize;
uniform vec2 uCellSize;
uniform vec2 uOrigin;
uniform vec2 uResolution;
uniform float uGooey;
uniform float uPull;
uniform float uCorner;
uniform float uSoftness;
uniform float uWrap;

vec2 wrapCell(vec2 c, vec2 g) {
  return mod(mod(c, g) + g, g);
}

bool inGrid(vec2 c, vec2 g) {
  return c.x >= 0.0 && c.y >= 0.0 && c.x < g.x && c.y < g.y;
}

vec2 sampleOcc(vec2 gc) {
  vec2 tc = uWrap >= 0.5 ? wrapCell(gc, uGridSize) : gc;
  if (uWrap < 0.5 && !inGrid(tc, uGridSize)) return vec2(0.0);
  return texelFetch(uGrid, ivec2(tc), 0).rg;
}

float sampleLive(vec2 gc, float ch) {
  vec2 o = sampleOcc(gc);
  return ch < 0.5 ? o.x : o.y;
}

vec2 cellCenter(vec2 gc) {
  return uOrigin + (gc + 0.5) * uCellSize;
}

float sdRoundBox(vec2 p, vec2 b, float r) {
  r = min(max(r, 0.0), min(b.x, b.y));
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float sdRoundBox4(vec2 p, vec2 b, vec4 r) {
  r.xy = (p.x > 0.0) ? r.xy : r.zw;
  r.x = (p.y > 0.0) ? r.x : r.y;
  r.x = max(r.x, 0.0);
  vec2 q = abs(p) - b + r.x;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r.x;
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / max(k, 1e-5), 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// Concave Goo-radius fillet at a 3-of-4 vertex, clipped to [0,rad]\xb2
// so the axis rays cannot become 1.25px hairlines after the seam.
float restNotch(vec2 px, vec2 vertexGc, float A, float B, float C, float D, float rad) {
  float n = A + B + C + D;
  if (abs(n - 3.0) > 0.5 || rad < 1e-4) return 1e5;
  vec2 q = px - (uOrigin + vertexGc * uCellSize);
  if (A < 0.5) q = -q;
  else if (B < 0.5) q.y = -q.y;
  else if (C < 0.5) q.x = -q.x;
  if (q.x < 0.0 || q.y < 0.0 || q.x > rad || q.y > rad) return 1e5;
  return rad - length(vec2(rad) - q);
}

bool needPull(vec2 a, vec2 b, float ch) {
  vec2 d = b - a;
  float adx = abs(d.x);
  float ady = abs(d.y);
  if (adx + ady < 1.5) return false;
  if (adx > 0.5 && ady > 0.5) return true;
  float sx = sign(d.x);
  float sy = sign(d.y);
  float steps = max(adx, ady);
  for (int s = 1; s < 5; s++) {
    if (float(s) >= steps - 0.5) break;
    if (sampleLive(a + vec2(sx, sy) * float(s), ch) < 0.5) return true;
  }
  return false;
}

void restFullCore(vec2 px, float ch, out float fullD, out float coreD) {
  vec2 gridPos = (px - uOrigin) / uCellSize;
  vec2 base = floor(gridPos);
  float blobScale = 0.5 + 0.1 * uPull;
  float unionD = 1e5;
  float alive[25];
  vec2 gcs[25];
  float ds[25];

  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      int idx = (j + 2) * 5 + (i + 2);
      vec2 gc = base + vec2(float(i), float(j));
      gcs[idx] = gc;
      float live = sampleLive(gc, ch);
      alive[idx] = live;
      ds[idx] = 1e5;
      if (live < 0.5) continue;
      float e = sampleLive(gc + vec2(1.0, 0.0), ch);
      float w = sampleLive(gc + vec2(-1.0, 0.0), ch);
      float s = sampleLive(gc + vec2(0.0, 1.0), ch);
      float n = sampleLive(gc + vec2(0.0, -1.0), ch);
      float ortho = max(e, max(w, max(s, n)));
      float ne = sampleLive(gc + vec2(1.0, 1.0), ch);
      float nw = sampleLive(gc + vec2(-1.0, 1.0), ch);
      float se = sampleLive(gc + vec2(1.0, -1.0), ch);
      float sw = sampleLive(gc + vec2(-1.0, -1.0), ch);
      float diag = max(ne, max(nw, max(se, sw)));
      float hu = (ortho > 0.5 || diag > 0.5) ? 0.5 : blobScale;
      vec2 he = hu * uCellSize;
      float rad = uCorner * hu * 2.0;
      vec4 rads = vec4(
        (1.0 - e) * (1.0 - s) * rad,
        (1.0 - e) * (1.0 - n) * rad,
        (1.0 - w) * (1.0 - s) * rad,
        (1.0 - w) * (1.0 - n) * rad
      );
      ds[idx] = sdRoundBox4(px - cellCenter(gc), he, rads);
      unionD = min(unionD, ds[idx]);
    }
  }

  float field = unionD;
  field = min(field, restNotch(px, base, alive[6], alive[7], alive[11], alive[12], uCorner));
  field = min(field, restNotch(px, base + vec2(1.0, 0.0), alive[7], alive[8], alive[12], alive[13], uCorner));
  field = min(field, restNotch(px, base + vec2(0.0, 1.0), alive[11], alive[12], alive[16], alive[17], uCorner));
  field = min(field, restNotch(px, base + vec2(1.0, 1.0), alive[12], alive[13], alive[17], alive[18], uCorner));
  field -= 1.25;
  coreD = field;

  if (uGooey <= 1e-4) { fullD = field; return; }

  float minCell = min(uCellSize.x, uCellSize.y);
  if (field < -0.25 * minCell || field > 1.65 * minCell) {
    fullD = field;
    return;
  }

  for (int n = 0; n < 25; n++) {
    if (alive[n] < 0.5) continue;
    for (int m = n + 1; m < 25; m++) {
      if (alive[m] < 0.5) continue;
      vec2 dlt = gcs[m] - gcs[n];
      float cheb = max(abs(dlt.x), abs(dlt.y));
      if (cheb > 2.5) continue;
      if (abs(dlt.x) > 0.5 && abs(dlt.x) < 1.5 && abs(dlt.y) > 0.5 && abs(dlt.y) < 1.5) {
        float o0 = sampleLive(vec2(gcs[n].x, gcs[m].y), ch);
        float o1 = sampleLive(vec2(gcs[m].x, gcs[n].y), ch);
        if (abs(o0 + o1 - 1.0) < 0.5) continue;
      }
      if (!needPull(gcs[n], gcs[m], ch)) continue;
      if (ds[n] < 0.0 || ds[m] < 0.0) continue;
      vec2 glueHe = 0.5 * uCellSize;
      float glueR = min(uCorner, min(glueHe.x, glueHe.y));
      float ga = sdRoundBox(px - cellCenter(gcs[n]), glueHe, glueR);
      float gb = sdRoundBox(px - cellCenter(gcs[m]), glueHe, glueR);
      field = min(field, smin(ga, gb, uGooey));
    }
  }
  fullD = field;
}
`,C=`${$}
uniform float uBlend;
uniform float uIdentical;
out vec4 fragColor;

void main() {
  vec2 px = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
  vec2 gridPos = (px - uOrigin) / uCellSize;
  if (uWrap < 0.5 && (
      gridPos.x < 0.0 || gridPos.y < 0.0 ||
      gridPos.x >= uGridSize.x || gridPos.y >= uGridSize.y)) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  float aa = max(uSoftness, 1.15);
  float fullD;
  float coreD;
  if (uIdentical > 0.5 || uBlend < 0.001 || uBlend > 0.999) {
    float ch = (uIdentical > 0.5 || uBlend > 0.5) ? 1.0 : 0.0;
    restFullCore(px, ch, fullD, coreD);
    float a = 1.0 - smoothstep(-aa, aa, fullD);
    float hold = 1.0 - smoothstep(-aa, aa, coreD);
    fragColor = vec4(a, a, hold, 1.0);
    return;
  }
  float f0;
  float c0;
  float f1;
  float c1;
  restFullCore(px, 0.0, f0, c0);
  restFullCore(px, 1.0, f1, c1);
  float a0 = 1.0 - smoothstep(-aa, aa, f0);
  float a1 = 1.0 - smoothstep(-aa, aa, f1);
  float hold = (1.0 - smoothstep(-aa, aa, c0)) * (1.0 - smoothstep(-aa, aa, c1));
  fragColor = vec4(a0, a1, hold, 1.0);
}
`,M=`#version 300 es
precision highp float;

uniform sampler2D uField;
uniform vec2 uResolution;
uniform float uBlend;
uniform float uSigma;
uniform vec2 uAxis;
uniform float uMix;
uniform float uWiggle;

out vec4 fragColor;

float liquidEase(float t) {
  t = clamp(t, 0.0, 1.0);
  return t * t * (10.0 + t * (-20.0 + t * (15.0 - 4.0 * t)));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec4 c = texture(uField, uv);
  float t = uBlend;
  float e = liquidEase(t);
  float inter = uMix > 0.5 ? c.b : c.g;
  float src = uMix > 0.5
    ? mix(c.r, c.g, e) + uWiggle * (max(c.g - c.r, 0.0) + 0.45 * min(c.r, c.g) + 0.25 * max(c.r - c.g, 0.0))
    : c.r;
  float sig = max(uSigma, 0.45);
  float acc = 0.0;
  float wsum = 0.0;
  for (int i = -24; i <= 24; i++) {
    float w = exp(-0.5 * float(i * i) / (sig * sig));
    vec4 s = texture(uField, uv + uAxis * float(i) / uResolution);
    float v = uMix > 0.5
      ? mix(s.r, s.g, e) + uWiggle * (max(s.g - s.r, 0.0) + 0.45 * min(s.r, s.g) + 0.25 * max(s.r - s.g, 0.0))
      : s.r;
    acc += v * w;
    wsum += w;
  }
  fragColor = vec4(acc / max(wsum, 1e-6), inter, 0.0, 1.0);
}
`,E=`#version 300 es
precision highp float;

uniform sampler2D uField;
uniform vec2 uResolution;
uniform vec2 uOrigin;
uniform vec2 uCellSize;
uniform vec2 uGridSize;
uniform float uWrap;
uniform float uSigma;
uniform vec2 uPtr;
uniform vec2 uPtrPrev;
uniform float uPtrVel;
uniform float uPtrAlive;

out vec4 fragColor;

vec2 wrapCell(vec2 c, vec2 g) {
  return mod(mod(c, g) + g, g);
}

bool inGrid(vec2 c, vec2 g) {
  return c.x >= 0.0 && c.y >= 0.0 && c.x < g.x && c.y < g.y;
}

vec2 cellCenter(vec2 gc) {
  return uOrigin + (gc + 0.5) * uCellSize;
}

float sdRoundBox(vec2 p, vec2 b, float r) {
  r = min(max(r, 0.0), min(b.x, b.y));
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float lineDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  return length(pa - ba * h);
}

float hoverAt(vec2 cellPx) {
  float minSide = min(uResolution.x, uResolution.y);
  float rad = max((0.035 + 0.25 * uPtrVel) * minSide, 1.0);
  float d = lineDist(cellPx, uPtrPrev, uPtr);
  float t = clamp(1.0 - d / rad, 0.0, 1.0);
  float amount = mix(0.22, 0.85, clamp(uPtrVel, 0.0, 1.0));
  return t * t * t * amount * uPtrAlive;
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 c = texture(uField, uv).rg;
  float blurred = c.r;
  float inter = c.g;
  float ae = max(0.035, 0.35 / max(uSigma, 1.0));
  float body = max(inter, smoothstep(0.5 - ae, 0.5 + ae, blurred));

  vec2 gridPos = (px - uOrigin) / uCellSize;
  if (uWrap < 0.5 && (
      gridPos.x < 0.0 || gridPos.y < 0.0 ||
      gridPos.x >= uGridSize.x || gridPos.y >= uGridSize.y)) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  float minCell = min(uCellSize.x, uCellSize.y);
  float dotR = clamp(minCell * 0.03, 1.15, 2.25);
  float lattice = 0.0;
  vec2 base = floor(gridPos);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 gc = base + vec2(float(i), float(j));
      if (uWrap < 0.5 && !inGrid(gc, uGridSize)) continue;
      if (uWrap >= 0.5) gc = wrapCell(gc, uGridSize);
      vec2 center = cellCenter(gc);
      float infl = hoverAt(center);
      float dotHalf = dotR * (1.0 + 0.55 * infl);
      float rad = dotHalf * mix(1.0, 0.42, infl);
      float sd = sdRoundBox(px - center, vec2(dotHalf), rad);
      float aa = max(0.75, fwidth(sd));
      lattice = max(lattice, 1.0 - smoothstep(0.0, aa, sd));
    }
  }

  float a = max(body, lattice);
  fragColor = vec4(vec3(a), 1.0);
}
`;class P{goo=.06;pull=.1;wrap=!0;softness=.2;wiggleEnabled=!1;canvas=null;gl=null;vao=null;tex=null;fieldProg=null;blurProg=null;composeProg=null;fieldUni=null;blurUni=null;composeUni=null;fboA=null;fboB=null;texA=null;texB=null;fboW=0;fboH=0;texCols=0;texRows=0;upload=null;blend=1;growth=0;morphDuration=1/12;ctx2d=null;off2d=null;offCtx=null;layout=null;camX=0;camY=0;camScale=1;ptrCssX=-1e6;ptrCssY=-1e6;ptrSampleCssX=-1e6;ptrSampleCssY=-1e6;ptrVel=0;ptrAlive=0;ptrLastT=0;ptrHaveSample=!1;ptrInside=!1;identical=!0;gridHash=0;lastFieldSig="";init(e,t={}){this.dispose(),this.canvas=e,this.goo=t.goo??.06,this.pull=t.pull??.1,this.wrap=t.wrap??!0;let i=e.getContext("webgl2",{alpha:!1,antialias:!1,depth:!1,stencil:!1,premultipliedAlpha:!1,preserveDrawingBuffer:!0,powerPreference:"high-performance"});if(i){this.gl=i;try{this.initGl(i),k("ok")}catch(t){console.warn("Life WebGL2 init failed; using canvas2d.",t),k(String(t));try{i.getExtension("WEBGL_lose_context")?.loseContext()}catch{}this.teardownGl(),this.init2d(e)}}else k("no-webgl2"),this.init2d(e);this.resize()}setGoo(e){this.goo=Math.min(3,Math.max(0,e)),this.layout&&(this.layout=this.computeLayout(this.layout.cols,this.layout.rows))}setPull(e){this.pull=Math.min(2,Math.max(0,e)),this.layout&&(this.layout=this.computeLayout(this.layout.cols,this.layout.rows))}get needsWake(){return this.ptrInside||this.ptrVel>.008||this.ptrAlive>.01}setPointer(e,t){this.ptrInside||(this.ptrHaveSample=!1),this.ptrCssX=e,this.ptrCssY=t,this.ptrInside=!0}clearPointer(){this.ptrInside=!1}setWiggleEnabled(e){this.wiggleEnabled=e}setMorphDuration(e){Number.isFinite(e)&&!(e<=0)&&(this.morphDuration=e)}setCamera(e,t,i){this.camX=e,this.camY=t,this.camScale=i,this.layout&&(this.layout=this.computeLayout(this.layout.cols,this.layout.rows))}cellAtCss(e,t){let i=this.layout;if(!i||i.cellCssW<=0||i.cellCssH<=0)return null;let r=Math.floor((e-i.originCssX)/i.cellCssW),o=Math.floor((t-i.originCssY)/i.cellCssH);if(this.wrap)r=(r%i.cols+i.cols)%i.cols,o=(o%i.rows+i.rows)%i.rows;else if(r<0||o<0||r>=i.cols||o>=i.rows)return null;return{x:r,y:o}}resize(){let e=this.canvas;if(!e)return;let t=Math.max(1,Math.min(window.devicePixelRatio||1,2)),i=e.parentElement,r=Math.max(1,e.clientWidth||i?.clientWidth||window.innerWidth),o=Math.max(1,e.clientHeight||i?.clientHeight||window.innerHeight),l=Math.max(1,Math.round(r*t)),a=Math.max(1,Math.round(o*t));(e.width!==l||e.height!==a)&&(e.width=l,e.height=a),this.gl?this.gl.viewport(0,0,l,a):this.off2d&&this.offCtx&&(this.off2d.width!==l||this.off2d.height!==a)&&(this.off2d.width=l,this.off2d.height=a),this.layout&&(this.layout=this.computeLayout(this.layout.cols,this.layout.rows))}render(e,t,i,r,o=1){if(!this.canvas||i<1||r<1)return;let l=i*r;if(e.length<l||t.length<l)return;this.blend=o<0?0:o>1?1:o,this.layout=this.computeLayout(i,r),this.stepPointer(this.layout.cssW,this.layout.cssH);let a=this.pack(e,t,i,r);this.gl&&this.fieldProg&&this.vao&&this.tex&&this.fieldUni?this.renderGl(a,i,r):this.ctx2d&&this.offCtx&&this.off2d&&this.render2d(e,t,i,r)}dispose(){this.teardownGl(),this.ctx2d=null,this.off2d=null,this.offCtx=null,this.canvas=null,this.layout=null,this.upload=null}pack(e,t,i,r){let o=i*r;this.upload&&this.upload.length===2*o||(this.upload=new Uint8Array(2*o));let l=this.upload,a=0,n=!0,s=0x811c9dc5;for(let i=0;i<o;i++){let r=+!!e[i],o=+!!t[i];l[2*i]=255*!!r,l[2*i+1]=255*!!o,r!==o&&(n=!1,a+=1),s=Math.imul(s^r+2*o,0x1000193)}return this.growth=a,this.identical=n,this.gridHash=s,l}link(e,t){let i=R(e,e.VERTEX_SHADER,S),r=R(e,e.FRAGMENT_SHADER,t),o=e.createProgram();if(!o)throw Error("program");if(e.attachShader(o,i),e.attachShader(o,r),e.linkProgram(o),e.deleteShader(i),e.deleteShader(r),!e.getProgramParameter(o,e.LINK_STATUS)){let t=e.getProgramInfoLog(o)||"link";throw e.deleteProgram(o),Error(t)}return o}initGl(e){let t=this.link(e,C),i=this.link(e,M),r=this.link(e,E),o=e.createVertexArray(),l=e.createTexture();if(!o||!l)throw Error("vao/tex");e.bindVertexArray(o),e.bindTexture(e.TEXTURE_2D,l),e.pixelStorei(e.UNPACK_ALIGNMENT,1),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,0),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE);let a=(t,i)=>{let r=e.getUniformLocation(t,i);if(!r)throw Error(i);return r};this.fieldProg=t,this.blurProg=i,this.composeProg=r,this.vao=o,this.tex=l,this.fieldUni={uGrid:a(t,"uGrid"),uGridSize:a(t,"uGridSize"),uCellSize:a(t,"uCellSize"),uOrigin:a(t,"uOrigin"),uResolution:a(t,"uResolution"),uGooey:a(t,"uGooey"),uPull:a(t,"uPull"),uCorner:a(t,"uCorner"),uSoftness:a(t,"uSoftness"),uWrap:a(t,"uWrap"),uBlend:a(t,"uBlend"),uIdentical:a(t,"uIdentical")},this.blurUni={uField:a(i,"uField"),uResolution:a(i,"uResolution"),uBlend:a(i,"uBlend"),uSigma:a(i,"uSigma"),uAxis:a(i,"uAxis"),uMix:a(i,"uMix"),uWiggle:a(i,"uWiggle")},this.composeUni={uField:a(r,"uField"),uResolution:a(r,"uResolution"),uOrigin:a(r,"uOrigin"),uCellSize:a(r,"uCellSize"),uGridSize:a(r,"uGridSize"),uWrap:a(r,"uWrap"),uSigma:a(r,"uSigma"),uPtr:a(r,"uPtr"),uPtrPrev:a(r,"uPtrPrev"),uPtrVel:a(r,"uPtrVel"),uPtrAlive:a(r,"uPtrAlive")}}ensureTargets(e,t,i){if(this.fboW===t&&this.fboH===i&&this.texA&&this.texB)return;this.texA&&e.deleteTexture(this.texA),this.texB&&e.deleteTexture(this.texB),this.fboA&&e.deleteFramebuffer(this.fboA),this.fboB&&e.deleteFramebuffer(this.fboB);let r=()=>{let r=e.createTexture();if(!r)throw Error("fbo tex");return e.bindTexture(e.TEXTURE_2D,r),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t,i,0,e.RGBA,e.UNSIGNED_BYTE,null),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),r},o=t=>{let i=e.createFramebuffer();if(!i)throw Error("fbo");if(e.bindFramebuffer(e.FRAMEBUFFER,i),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,t,0),e.checkFramebufferStatus(e.FRAMEBUFFER)!==e.FRAMEBUFFER_COMPLETE)throw Error("fbo incomplete");return i};this.texA=r(),this.texB=r(),this.fboA=o(this.texA),this.fboB=o(this.texB),this.fboW=t,this.fboH=i,this.lastFieldSig="",e.bindFramebuffer(e.FRAMEBUFFER,null)}init2d(e){let t=e,i=t.getContext("2d",{alpha:!1})||t.getContext("2d");if(!i){let r=document.createElement("canvas");r.className=e.className;let o=e.getAttribute("style");o&&r.setAttribute("style",o),r.style.display="block",r.style.width="100%",r.style.height="100%",e.replaceWith(r),t=r,i=r.getContext("2d",{alpha:!1})||r.getContext("2d")}if(!i)return void k("no-2d");this.canvas=t,this.ctx2d=i;let r="function"==typeof OffscreenCanvas?new OffscreenCanvas(1,1):document.createElement("canvas"),o=r.getContext("2d",{willReadFrequently:!0})||r.getContext("2d");o?(this.off2d=r,this.offCtx=o):k("no-offscreen-2d")}bindFieldUniforms(e,t,i){let r=this.layout,o=this.fieldUni;e.uniform1i(o.uGrid,0),e.uniform2f(o.uGridSize,t,i),e.uniform2f(o.uCellSize,r.cellDevW,r.cellDevH),e.uniform2f(o.uOrigin,r.originDevX,r.originDevY),e.uniform2f(o.uResolution,e.drawingBufferWidth,e.drawingBufferHeight),e.uniform1f(o.uGooey,r.gooeyDev),e.uniform1f(o.uPull,this.pull),e.uniform1f(o.uCorner,r.cornerDev),e.uniform1f(o.uSoftness,r.softDev),e.uniform1f(o.uWrap,+!!this.wrap),e.uniform1f(o.uBlend,this.blend),e.uniform1f(o.uIdentical,+!!this.identical)}renderGl(e,t,i){let r=this.gl,o=this.layout,l=r.drawingBufferWidth,a=r.drawingBufferHeight;this.ensureTargets(r,l,a),r.bindTexture(r.TEXTURE_2D,this.tex),t!==this.texCols||i!==this.texRows?(r.texImage2D(r.TEXTURE_2D,0,r.RG8,t,i,0,r.RG,r.UNSIGNED_BYTE,e),this.texCols=t,this.texRows=i):r.texSubImage2D(r.TEXTURE_2D,0,0,0,t,i,r.RG,r.UNSIGNED_BYTE,e);let n=this.blend,s=Math.max(.45,.42*Math.min(o.cellDevW,o.cellDevH)*function(e=!1){return w}(this.identical)),u=this.wiggleEnabled?y(n,this.growth,this.morphDuration):0,h=[t,i,l,a,this.blend,+!!this.identical,this.gridHash,o.originDevX,o.originDevY,o.cellDevW,o.cellDevH,o.gooeyDev,this.pull,o.cornerDev,+!!this.wrap,s,u].join();if(r.disable(r.BLEND),r.disable(r.DEPTH_TEST),r.bindVertexArray(this.vao),r.viewport(0,0,l,a),h!==this.lastFieldSig){r.bindFramebuffer(r.FRAMEBUFFER,this.fboA),r.useProgram(this.fieldProg),r.activeTexture(r.TEXTURE0),r.bindTexture(r.TEXTURE_2D,this.tex),this.bindFieldUniforms(r,t,i),r.drawArrays(r.TRIANGLES,0,3);let e=this.blurUni;r.bindFramebuffer(r.FRAMEBUFFER,this.fboB),r.useProgram(this.blurProg),r.bindTexture(r.TEXTURE_2D,this.texA),r.uniform1i(e.uField,0),r.uniform2f(e.uResolution,l,a),r.uniform1f(e.uBlend,this.blend),r.uniform1f(e.uSigma,s),r.uniform1f(e.uWiggle,u),r.uniform2f(e.uAxis,1,0),r.uniform1f(e.uMix,1),r.drawArrays(r.TRIANGLES,0,3),r.bindFramebuffer(r.FRAMEBUFFER,this.fboA),r.bindTexture(r.TEXTURE_2D,this.texB),r.uniform2f(e.uAxis,0,1),r.uniform1f(e.uMix,0),r.drawArrays(r.TRIANGLES,0,3),this.lastFieldSig=h}let c=this.composeUni,d=o.cssW>0?this.canvas.width/o.cssW:1;r.bindFramebuffer(r.FRAMEBUFFER,null),r.clearColor(0,0,0,1),r.clear(r.COLOR_BUFFER_BIT),r.useProgram(this.composeProg),r.bindTexture(r.TEXTURE_2D,this.texA),r.uniform1i(c.uField,0),r.uniform2f(c.uResolution,l,a),r.uniform2f(c.uOrigin,o.originDevX,o.originDevY),r.uniform2f(c.uCellSize,o.cellDevW,o.cellDevH),r.uniform2f(c.uGridSize,t,i),r.uniform1f(c.uWrap,+!!this.wrap),r.uniform1f(c.uSigma,Math.max(s,1)),r.uniform2f(c.uPtr,this.ptrCssX*d,this.ptrCssY*d),r.uniform2f(c.uPtrPrev,this.ptrSampleCssX*d,this.ptrSampleCssY*d),r.uniform1f(c.uPtrVel,this.ptrVel),r.uniform1f(c.uPtrAlive,this.ptrAlive),r.drawArrays(r.TRIANGLES,0,3),this.commitPointerSample()}paintRest(e,t,i,r){let o=this.layout,l=this.wrap?[-1,0,1]:[0],a=(e,t,a)=>{for(let n of l)if(0===n||!(t>3)||!(t<r-4))for(let s of l){if(0===s||!(e>3)||!(e<i-4))a(o.originDevX+(e+s*i+.5)*o.cellDevW,o.originDevY+(t+n*r+.5)*o.cellDevH)}},n=(t,i,r,o,l)=>{e.beginPath(),"function"==typeof e.roundRect?e.roundRect(t-r,i-o,2*r,2*o,l):e.rect(t-r,i-o,2*r,2*o),e.fill()};e.fillStyle="#fff";for(let e=0;e<r;e++)for(let r=0;r<i;r++){if(!t(r,e))continue;let i=t(r+1,e),l=t(r-1,e),s=t(r,e+1),u=t(r,e-1),h=Math.min(o.cornerDev,Math.min(o.halfDevW,o.halfDevH)),c=[i||s?0:h,i||u?0:h,l||s?0:h,l||u?0:h];a(r,e,(e,t)=>{n(e,t,o.halfDevW+.6,o.halfDevH+.6,c)})}let s=o.cornerDev;if(s>.6)for(let l=-1;l<r;l++)for(let r=-1;r<i;r++){let i=t(r,l),a=t(r+1,l),n=t(r,l+1),u=t(r+1,l+1);if(i+a+n+u!==3)continue;let h=o.originDevX+(r+1)*o.cellDevW,c=o.originDevY+(l+1)*o.cellDevH;e.beginPath(),e.moveTo(h,c),u?n?i?(e.lineTo(h+s,c),e.arc(h+s,c-s,s,Math.PI/2,Math.PI,!1)):(e.lineTo(h-s,c),e.arc(h-s,c-s,s,Math.PI/2,0,!0)):(e.lineTo(h-s,c),e.arc(h-s,c+s,s,-Math.PI/2,0,!1)):(e.lineTo(h+s,c),e.arc(h+s,c+s,s,-Math.PI/2,Math.PI,!1)),e.closePath(),e.fill()}}render2d(e,t,i,r){let o,l,a,n=this.canvas,s=this.ctx2d;this.off2d;let u=this.offCtx,h=this.layout,c=n.width,d=n.height,f=this.blend,p=(a=f<0?0:f>1?1:f)*a*(10+a*(-20+a*(15-4*a))),m=this.wiggleEnabled?y(f,this.growth,this.morphDuration):0,b=(e,t,o)=>{let l=t,a=o;if(this.wrap)l=(t%i+i)%i,a=(o%r+r)%r;else if(t<0||o<0||t>=i||o>=r)return 0;return+!!e[a*i+l]};u.setTransform(1,0,0,1,0,0);let g=e=>(u.fillStyle="#000",u.fillRect(0,0,c,d),this.paintRest(u,(t,i)=>b(e,t,i),i,r),u.getImageData(0,0,c,d).data);f<.001?o=l=g(e):f>.999?o=l=g(t):(o=g(e),l=g(t));let x=new Float32Array(c*d),v=new Uint8Array(c*d);for(let e=0,t=0;e<x.length;e++,t+=4){let i=o[t]/255,r=l[t]/255;x[e]=i*(1-p)+r*p+function(e,t,i){if(0===i)return 0;let r=Math.max(t-e,0),o=Math.max(e-t,0);return i*(+r+.45*Math.min(e,t)+.25*o)}(i,r,m),v[e]=+(i>.5&&r>.5)}let S=function(e,t,i,r){if(r<.45)return e;let o=Math.max(1,Math.ceil(2.2*r)),l=[],a=0;for(let e=-o;e<=o;e++){let t=Math.exp(-.5*e*e/(r*r));l.push(t),a+=t}for(let e=0;e<l.length;e++)l[e]/=a;let n=new Float32Array(t*i),s=new Float32Array(t*i);for(let r=0;r<i;r++)for(let i=0;i<t;i++){let a=0;for(let n=-o;n<=o;n++)a+=e[r*t+Math.min(t-1,Math.max(0,i+n))]*l[n+o];n[r*t+i]=a}for(let e=0;e<i;e++)for(let r=0;r<t;r++){let a=0;for(let s=-o;s<=o;s++)a+=n[Math.min(i-1,Math.max(0,e+s))*t+r]*l[s+o];s[e*t+r]=a}return s}(x,c,d,Math.max(.45,.42*Math.min(h.cellDevW,h.cellDevH)*function(e=!1){return w}(this.identical))),$=s.createImageData(c,d);for(let e=0,t=0;e<S.length;e++,t+=4){let i=v[e]||S[e]>=.5?255:0;$.data[t]=i,$.data[t+1]=i,$.data[t+2]=i,$.data[t+3]=255}s.putImageData($,0,0);let C=this.wrap?[-1,0,1]:[0],M=Math.min(2.25,Math.max(1.15,.03*Math.min(h.cellDevW,h.cellDevH))),E=h.cssW>0?n.width/h.cssW:1,P=this.ptrCssX*E,k=this.ptrCssY*E,R=this.ptrSampleCssX*E,T=this.ptrSampleCssY*E,D=Math.max((.035+.25*this.ptrVel)*Math.min(c,d),1),A=.22+.63*this.ptrVel;s.fillStyle="#fff";for(let e=0;e<r;e++)for(let t=0;t<i;t++)for(let o of C)if(0===o||!(e>3)||!(e<r-4))for(let l of C){if(0!==l&&t>3&&t<i-4)continue;let a=h.originDevX+(t+l*i+.5)*h.cellDevW,n=h.originDevY+(e+o*r+.5)*h.cellDevH,u=Math.max(0,Math.min(1,1-function(e,t,i,r,o,l){let a=e-i,n=t-r,s=o-i,u=l-r,h=s*s+u*u,c=h<=1e-8?0:Math.min(1,Math.max(0,(a*s+n*u)/h));return Math.hypot(a-s*c,n-u*c)}(a,n,R,T,P,k)/D)),c=u*u*u*A*this.ptrAlive,d=M*(1+.55*c),f=d*(1-c+.42*c);s.beginPath(),"function"==typeof s.roundRect?s.roundRect(a-d,n-d,2*d,2*d,f):s.arc(a,n,d,0,2*Math.PI),s.fill()}this.commitPointerSample()}stepPointer(e,t){let i="u">typeof performance?performance.now():0,r=Math.min(.05,Math.max(0,0===this.ptrLastT?1/60:(i-this.ptrLastT)/1e3));this.ptrLastT=i;let o=Math.exp(Math.log(.9)*Math.min(2,60*r));if(!this.ptrInside){this.ptrAlive=Math.max(0,this.ptrAlive-r/.12),this.ptrVel*=o,this.ptrSampleCssX=this.ptrCssX,this.ptrSampleCssY=this.ptrCssY;return}if(this.ptrAlive=1,!this.ptrHaveSample){this.ptrSampleCssX=this.ptrCssX,this.ptrSampleCssY=this.ptrCssY,this.ptrHaveSample=!0;return}let l=Math.hypot((this.ptrCssX-this.ptrSampleCssX)/Math.max(e,1),(this.ptrCssY-this.ptrSampleCssY)/Math.max(t,1));r>=.014&&l>0&&!(r>.1)&&(this.ptrVel=Math.min(1,this.ptrVel+2*l)),this.ptrVel*=o}commitPointerSample(){this.ptrSampleCssX=this.ptrCssX,this.ptrSampleCssY=this.ptrCssY}computeLayout(e,t){let i=this.canvas,r=i.parentElement,o=Math.max(1,i.clientWidth||r?.clientWidth||window.innerWidth),l=Math.max(1,i.clientHeight||r?.clientHeight||window.innerHeight),a=i.width/o,n=this.camScale,s=o/e*n,u=l/t*n,h=Math.min(s,u),c=this.goo,d=this.pull,f=Math.min(1,Math.max(0,c/3)),p=.5*s,m=.5*u,b=Math.min(p,m),g=1.05*Math.max(0,d)*h;return{cssW:o,cssH:l,cols:e,rows:t,originCssX:this.camX,originCssY:this.camY,cellCssW:s,cellCssH:u,originDevX:this.camX*a,originDevY:this.camY*a,cellDevW:s*a,cellDevH:u*a,halfDevW:p*a,halfDevH:m*a,cornerDev:f*b*a,gooeyDev:g*a,softDev:this.softness*a,range:1}}teardownGl(){let e=this.gl;e&&(this.tex&&e.deleteTexture(this.tex),this.texA&&e.deleteTexture(this.texA),this.texB&&e.deleteTexture(this.texB),this.fboA&&e.deleteFramebuffer(this.fboA),this.fboB&&e.deleteFramebuffer(this.fboB),this.vao&&e.deleteVertexArray(this.vao),this.fieldProg&&e.deleteProgram(this.fieldProg),this.blurProg&&e.deleteProgram(this.blurProg),this.composeProg&&e.deleteProgram(this.composeProg)),this.gl=null,this.fieldProg=null,this.blurProg=null,this.composeProg=null,this.vao=null,this.tex=null,this.texA=null,this.texB=null,this.fboA=null,this.fboB=null,this.fieldUni=null,this.blurUni=null,this.composeUni=null,this.texCols=0,this.texRows=0,this.fboW=0,this.fboH=0,this.lastFieldSig=""}}function k(e){window.__mmLifeGL=e}function R(e,t,i){let r=e.createShader(t);if(!r)throw Error("shader");if(e.shaderSource(r,i),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS)){let t=e.getShaderInfoLog(r)||"compile";throw e.deleteShader(r),Error(t)}return r}function T({pattern:e,active:i}){let r=(0,a.useRef)(null);return(0,a.useEffect)(()=>{let t=r.current;if(!t)return;let{width:i,height:o,cells:l}=b(e),a=Math.max(i+4,8),n=Math.max(o+4,8),s=Math.min(window.devicePixelRatio||1,2);t.width=Math.round(88*s),t.height=Math.round(88*s);let u=t.getContext("2d");if(!u)return;u.setTransform(s,0,0,s,0,0),u.fillStyle="#000",u.fillRect(0,0,88,88);let h=Math.min(88/a,88/n),c=(88-a*h)/2,d=(88-n*h)/2,f=.48*h;for(let[e,t]of(u.fillStyle="#fff",l)){let i=c+(e+2+.5)*h,r=d+(t+2+.5)*h;u.beginPath(),u.roundRect(i-f,r-f,2*f,2*f,f),u.fill()}},[e]),(0,t.jsx)("canvas",{ref:r,className:`h-[72px] w-[72px] shrink-0 bg-black transition-opacity duration-300 ${i?"opacity-100":"opacity-40"}`,"aria-hidden":!0})}let D=["gun","setup","oscillator","spaceship","puffer","methuselah","still-life"];function A({open:e,serifClassName:i,onClose:r,onSelect:o}){let[l,n]=(0,a.useState)(null),s=(0,a.useRef)(null);(0,a.useEffect)(()=>{if(!e)return;let t=document.body.style.overflow;return document.body.style.overflow="hidden",s.current?.focus(),()=>{document.body.style.overflow=t}},[e]);let u=(0,a.useMemo)(()=>{let e=[...m.filter(e=>e.featured),...m.filter(e=>!e.featured)],t=new Map;for(let i of e){let e=t.get(i.category);e?e.push(i):t.set(i.category,[i])}return[...t.entries()].sort((e,t)=>D.indexOf(e[0])-D.indexOf(t[0])).map(([e,t])=>({key:e,label:e.replace(/[-_]/g," "),items:t}))},[]);return e?(0,t.jsx)("div",{role:"dialog","aria-modal":"true","aria-labelledby":"inspirations-title",className:"fixed inset-0 z-50 overflow-y-auto bg-black text-white",children:(0,t.jsxs)("div",{className:"mx-auto min-h-dvh w-full max-w-6xl px-5 py-8 sm:px-10 sm:py-12 md:px-16 md:py-16",children:[(0,t.jsxs)("header",{className:"mb-14 flex items-start justify-between gap-8",children:[(0,t.jsxs)("div",{className:"space-y-4",children:[(0,t.jsx)("p",{className:"text-[10px] uppercase tracking-[0.28em] text-white/40",children:"Archive"}),(0,t.jsx)("h2",{id:"inspirations-title",className:`${i} text-[40px] leading-none italic md:text-[64px]`,children:"Inspirations"}),(0,t.jsx)("p",{className:`${i} max-w-[28ch] text-[18px] leading-snug text-white/55 italic`,children:"The forms that made Life famous. Click one and it takes the field."})]}),(0,t.jsx)("button",{ref:s,type:"button",className:"bg-transparent p-0 pt-2 text-[11px] uppercase tracking-[0.22em] text-white transition-opacity duration-200 hover:opacity-40",onClick:r,children:"Close"})]}),(0,t.jsx)("div",{className:"flex flex-col gap-16 pb-24",children:u.map(e=>(0,t.jsxs)("section",{className:"space-y-5",children:[(0,t.jsx)("h3",{className:"text-[10px] uppercase tracking-[0.28em] text-white/35",children:e.label}),(0,t.jsx)("ul",{children:e.items.map((e,r)=>{let a=l===e.id;return(0,t.jsx)("li",{children:(0,t.jsxs)("button",{type:"button",className:"flex w-full items-center gap-6 border-t border-white/10 bg-transparent py-5 text-left transition-opacity duration-200 hover:opacity-70",onMouseEnter:()=>n(e.id),onFocus:()=>n(e.id),onClick:()=>o(e),children:[(0,t.jsx)("span",{className:"w-8 shrink-0 text-[10px] uppercase tracking-[0.22em] text-white/30 tabular-nums",children:String(r+1).padStart(2,"0")}),(0,t.jsxs)("span",{className:"min-w-0 flex-1",children:[(0,t.jsx)("span",{className:`${i} block text-[26px] leading-none italic md:text-[34px]`,children:e.name}),(0,t.jsx)("span",{className:"mt-2 block max-w-xl text-[13px] leading-relaxed text-white/40",children:e.description})]}),(0,t.jsx)("span",{className:"hidden shrink-0 text-[10px] uppercase tracking-[0.22em] text-white/30 sm:block",children:e.period?`p${e.period}`:e.category}),(0,t.jsx)(T,{pattern:e,active:a||null===l})]})},e.id)})})]},e.key))})]})}):null}function B({label:e,value:i,min:r,max:o,step:l=1,display:n,onChange:s}){let u=(0,a.useRef)(null),h=(0,a.useCallback)(e=>{let t=u.current;if(!t)return;let i=t.getBoundingClientRect(),a=Math.round((r+(i.width<=0?0:(e-i.left)/i.width)*(o-r))/l)*l;s(Math.min(o,Math.max(r,a)))},[o,r,s,l]),c=o-r||1,d=(i-r)/c*100;return(0,t.jsxs)("label",{className:"flex flex-col gap-2",children:[(0,t.jsxs)("span",{className:"flex items-baseline justify-between text-[10px] uppercase tracking-[0.22em]",children:[(0,t.jsx)("span",{children:e}),(0,t.jsx)("span",{className:"tabular-nums",children:n})]}),(0,t.jsxs)("div",{ref:u,role:"slider",tabIndex:0,"aria-label":e,"aria-valuemin":r,"aria-valuemax":o,"aria-valuenow":i,className:"relative flex h-7 cursor-ew-resize items-center touch-none",onPointerDown:e=>{0===e.button&&(e.preventDefault(),e.stopPropagation(),e.currentTarget.setPointerCapture(e.pointerId),h(e.clientX))},onPointerMove:e=>{e.currentTarget.hasPointerCapture(e.pointerId)&&h(e.clientX)},onPointerUp:e=>{try{e.currentTarget.releasePointerCapture(e.pointerId)}catch{}},onKeyDown:e=>{("ArrowLeft"===e.key||"ArrowDown"===e.key)&&(e.preventDefault(),s(Math.max(r,i-l))),("ArrowRight"===e.key||"ArrowUp"===e.key)&&(e.preventDefault(),s(Math.min(o,i+l)))},children:[(0,t.jsx)("span",{"aria-hidden":!0,className:"pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/80"}),(0,t.jsx)("span",{"aria-hidden":!0,className:"pointer-events-none absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 bg-white",style:{left:`${d}%`}})]})]})}let F="cursor-pointer bg-transparent p-0 text-[11px] font-medium uppercase tracking-[0.22em] text-white transition-opacity duration-200 hover:opacity-45 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-white";function N({serifClassName:e,playing:i,status:r,speed:o,speedMin:l,speedMax:a,generation:n,overlayOpen:s,wiggle:u,onTogglePlay:h,onStep:c,onClear:d,onChance:f,onSpeed:p,onToggleWiggle:m,onInspirations:b}){return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsxs)("header",{className:"pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-5 pt-5 sm:px-8 sm:pt-8 md:px-12 md:pt-10",children:[(0,t.jsxs)("div",{children:[(0,t.jsx)("h1",{className:`${e} text-[34px] leading-none text-white italic sm:text-[44px] md:text-[52px]`,children:"MM"}),(0,t.jsx)("p",{className:`${e} mt-3 hidden max-w-[16ch] text-[22px] leading-[0.95] text-white italic sm:block md:text-[28px]`,children:"Form that keeps living."})]}),(0,t.jsx)("button",{type:"button",className:`${F} pointer-events-auto pt-2`,onClick:b,children:s?"Close":"Inspirations"})]}),(0,t.jsxs)("footer",{className:"pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col gap-6 px-5 pb-5 sm:px-8 sm:pb-8 md:flex-row md:items-end md:justify-between md:px-12 md:pb-10",children:[(0,t.jsxs)("div",{className:"flex flex-col gap-3",children:[(0,t.jsx)("p",{className:"text-[10px] uppercase tracking-[0.22em] text-white/70","aria-live":"polite",children:r}),(0,t.jsx)("nav",{"aria-label":"Life",className:"pointer-events-auto flex flex-wrap items-center gap-x-3 gap-y-2",children:[{label:i?"Pause":"Play",onClick:h},{label:"Step",onClick:c},{label:"Clear",onClick:d},{label:"Chance",onClick:f}].map((e,i)=>(0,t.jsxs)("span",{className:"flex items-center gap-3",children:[i>0&&(0,t.jsx)("span",{"aria-hidden":!0,className:"text-[11px] tracking-[0.22em] opacity-35",children:"·"}),(0,t.jsx)("button",{type:"button",className:F,onClick:e.onClick,children:e.label})]},e.label))})]}),(0,t.jsxs)("div",{className:"pointer-events-auto flex w-full max-w-xs flex-col gap-5 md:w-72",children:[(0,t.jsxs)("button",{type:"button",className:`${F} self-start ${u?"":"opacity-35"}`,"aria-pressed":u,onClick:m,children:["Wiggle ",u?"on":"off"]}),(0,t.jsx)(B,{label:"Pace",value:o,min:l,max:a,display:`${o} /s`,onChange:p}),(0,t.jsxs)("p",{className:"text-[10px] uppercase tracking-[0.22em] text-white/40 tabular-nums",children:["Gen. ",n.toLocaleString("en-US")]})]})]})]})}let _="gosper-glider-gun";function L(e,t){let i,r=(i=window.innerWidth)<700?16:i<1080?18:22;return{cols:Math.max(36,Math.round(e/r)),rows:Math.max(24,Math.round(t/r))}}function U(e,t){var i,r,o,l;let a=b(t),n=(i=a.width,r=a.height,o=e.width,l=e.height,"gun"===t.category||/gun/i.test(t.id)?{x:Math.max(2,Math.floor(.08*o)),y:Math.max(2,Math.floor((l-r)/2))}:{x:Math.floor((o-i)/2),y:Math.floor((l-r)/2)});e.clear(),e.stampPattern(a.cells,n.x,n.y)}function W(){return new URLSearchParams(window.location.search)}e.s(["default",0,function(){let e=(0,a.useRef)(null),i=(0,a.useRef)(null),o=(0,a.useRef)(null),n=(0,a.useRef)(null),u=(0,a.useRef)(null),h=(0,a.useRef)(!1),d=(0,a.useRef)(1),f=(0,a.useRef)(null),p=(0,a.useRef)(0),m=(0,a.useRef)(!1),b=(0,a.useRef)(!0),y=(0,a.useRef)({x:0,y:0,scale:1}),[w,S]=(0,a.useState)(!0),[$,C]=(0,a.useState)(12),[M,E]=(0,a.useState)(1),[k,R]=(0,a.useState)(0),[T,D]=(0,a.useState)(!1),[B,F]=(0,a.useState)(()=>v()),G=(0,a.useCallback)(()=>{let e=o.current;e&&(E(e.liveCount()),R(e.generation))},[]),I=(0,a.useCallback)((e,t=!0)=>{let i=o.current,r=n.current;i&&r&&(U(i,e),r.align(),t&&(r.play(),b.current=!0,S(!0)),G())},[G]);(0,a.useEffect)(()=>{m.current=T},[T]),(0,a.useEffect)(()=>{let t=e.current;if(!t)return;let i=e=>{if(m.current||!t.contains(e.target))return;e.preventDefault();let i=y.current,r=1===e.deltaMode,o=2===e.deltaMode,l=e.deltaY*(r?16:o?t.clientHeight:1),a=e.deltaX*(r?16:o?t.clientWidth:1);if(e.ctrlKey||e.metaKey){let o=t.getBoundingClientRect(),a=e.clientX-o.left,n=e.clientY-o.top,s=Math.min(8,Math.max(.35,i.scale*Math.exp(-(r?.05*e.deltaY:.002*l))));if(s===i.scale)return;let u=s/i.scale;i.x=a-(a-i.x)*u,i.y=n-(n-i.y)*u,i.scale=s}else i.x-=a,i.y-=l;u.current?.setCamera(i.x,i.y,i.scale),n.current?.nudge()},r=e=>e.preventDefault(),o={passive:!1,capture:!0};return t.addEventListener("wheel",i,o),t.addEventListener("gesturestart",r,o),t.addEventListener("gesturechange",r,o),t.addEventListener("gestureend",r,o),()=>{t.removeEventListener("wheel",i,o),t.removeEventListener("gesturestart",r,o),t.removeEventListener("gesturechange",r,o),t.removeEventListener("gestureend",r,o)}},[]),(0,a.useEffect)(()=>{let t,r,l=i.current,a=e.current;if(!l||!a)return;let{cols:h,rows:d}=L(Math.max(1,l.clientWidth||a.clientWidth||window.innerWidth),Math.max(1,l.clientHeight||a.clientHeight||window.innerHeight)),f="0"!==(t=W()?.get("play"))&&"off"!==t,p=new s(h,d),m=new P;m.init(l,{wrap:!0,goo:1.4,pull:.43}),m.setWiggleEnabled(v()),m.setCamera(y.current.x,y.current.y,y.current.scale);let x=0,w=new c({engine:p,speed:12,isBusy:()=>m.needsWake,onFrame:({steps:e,blend:t,morphDuration:i,previous:r,current:o})=>{if(m.setMorphDuration(i),m.render(r,o,p.width,p.height,t),e>0){let e=performance.now();e-x>140&&(x=e,R(p.generation),E(p.liveCount()))}}});o.current=p,u.current=m,n.current=w;let $=(r=W(),g(r?.get("p")||_)??g(_));$&&U(p,$);let C=function(){let e=W()?.get("blend");if(null==e)return null;let t=Number(e);return Number.isFinite(t)?t<0?0:t>1?1:t:null}();null!=C?(w.align(),w.previous.set(p.cells),p.step(),w.blend=C):w.align(),w.start(),null!=C?(b.current=!1,S(!1)):f?(w.play(),b.current=!0,S(!0)):(w.pause(),b.current=!1,S(!1)),E(p.liveCount()),R(0);let M=()=>{let e=L(l.clientWidth||a.clientWidth,l.clientHeight||a.clientHeight);(p.width!==e.cols||p.height!==e.rows)&&(p.resize(e.cols,e.rows),w.align()),m.resize()},k=new ResizeObserver(M);return k.observe(a),M(),()=>{k.disconnect(),w.stop(),m.dispose(),o.current=null,n.current=null,u.current=null}},[64]);let j=(t,i)=>{let r=e.current;if(!r)return null;let o=r.getBoundingClientRect();return u.current?.cellAtCss(t-o.left,i-o.top)??null},X=(t,i)=>{let r=e.current;if(!r)return;let o=r.getBoundingClientRect();u.current?.setPointer(t-o.left,i-o.top),n.current?.nudge()},H=e=>{if(h.current){h.current=!1,f.current=null;try{e.currentTarget.releasePointerCapture(e.pointerId)}catch{}}},z=(0,a.useCallback)(()=>{let e=n.current;e&&(e.togglePlaying(),b.current=e.playing,S(e.playing))},[]),q=(0,a.useCallback)(()=>{let e=n.current;e&&(e.pause(),b.current=!1,S(!1),e.stepOnce(),G())},[G]),Y=(0,a.useCallback)(()=>{o.current?.clear(),n.current?.pause(),n.current?.align(),b.current=!1,S(!1),G()},[G]),O=(0,a.useCallback)(()=>{o.current?.randomize(.11),n.current?.align(),G()},[G]),V=(0,a.useCallback)(e=>{let t=Math.min(60,Math.max(1,e));n.current?.setSpeed(t),C(t)},[]),K=(0,a.useCallback)(()=>{F(e=>{var t;let i=(t=!e,window.localStorage.setItem(x,t?"1":"0"),t);return u.current?.setWiggleEnabled(i),i})},[]),Q=(0,a.useCallback)(e=>{I(e,!0),D(!1)},[I]);(0,a.useEffect)(()=>{let e=e=>{if(!(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)){if("Escape"===e.key){m.current&&(e.preventDefault(),D(!1));return}if("i"===e.key||"I"===e.key){e.preventDefault(),D(e=>!e);return}if(!m.current){if(" "===e.key||"Space"===e.code){e.preventDefault(),z();return}if("c"===e.key||"C"===e.key){e.preventDefault(),Y();return}if("r"===e.key||"R"===e.key){e.preventDefault(),O();return}if("+"===e.key||"="===e.key){e.preventDefault(),V($+1);return}if("-"===e.key||"_"===e.key){e.preventDefault(),V($-1);return}("ArrowRight"===e.key||"ArrowLeft"===e.key||"ArrowUp"===e.key||"ArrowDown"===e.key)&&(e.preventDefault(),q())}}};return window.addEventListener("keydown",e),()=>window.removeEventListener("keydown",e)},[O,V,Y,$,q,z]),(0,a.useEffect)(()=>{let e=n.current;e&&(T?e.pause():b.current&&e.play())},[T]);let J=0===M?"Barren.":w&&!T?"Live.":"Still.";return(0,t.jsxs)("section",{ref:e,"aria-label":"Conway's Game of Life",className:`${l.className} relative h-dvh w-full overflow-hidden bg-black text-white [overscroll-behavior:none]`,children:[(0,t.jsx)("canvas",{ref:i,className:"pointer-events-none absolute inset-0 block h-full w-full outline-none","aria-hidden":!0},64),(0,t.jsx)("div",{className:"absolute inset-0 z-10 cursor-crosshair touch-none",onPointerDown:e=>{let t;if(1===e.button)return;let i=o.current;if(!i)return;e.preventDefault(),e.currentTarget.setPointerCapture(e.pointerId),X(e.clientX,e.clientY),(t=n.current)&&(t.beginStroke(),b.current=!1,S(!1));let r=j(e.clientX,e.clientY);r&&(d.current=+!(2===e.button||e.shiftKey||e.altKey||1===i.get(r.x,r.y)),h.current=!0,f.current=r,n.current?.stamp(r.x,r.y,d.current),p.current=performance.now(),G())},onPointerMove:e=>{if(X(e.clientX,e.clientY),!h.current||!o.current)return;let t=j(e.clientX,e.clientY);if(!t)return;let i=f.current;if(i&&i.x===t.x&&i.y===t.y)return;i?n.current?.stampLine(i.x,i.y,t.x,t.y,d.current):n.current?.stamp(t.x,t.y,d.current),f.current=t;let r=performance.now();r-p.current>80&&(p.current=r,G())},onPointerUp:H,onPointerCancel:H,onPointerLeave:()=>{u.current?.clearPointer(),n.current?.nudge()},onContextMenu:e=>e.preventDefault()}),(0,t.jsx)(N,{serifClassName:r.className,playing:w&&!T,status:J,speed:$,speedMin:1,speedMax:60,generation:k,overlayOpen:T,wiggle:B,onTogglePlay:z,onStep:q,onClear:Y,onChance:O,onSpeed:V,onToggleWiggle:K,onInspirations:()=>D(e=>!e)}),(0,t.jsx)(A,{open:T,serifClassName:r.className,onClose:()=>D(!1),onSelect:Q})]})}],81524)}]);
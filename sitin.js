"use strict";

const SAVE_KEY="SITIN_SAVE";
const state={
 money:1000,oil:500,industry:100,income:50,
 army:{infantry:600,armor:250,air:100,navy:50},
 selected:null, deployed:0, tick:0
};
const countries=[
 {id:"sitin",name:"SITIN",flag:"🏴",x:.50,y:.43,color:0x4f8cff,power:100},
 {id:"aurora",name:"AURORA",flag:"🌐",x:.38,y:.30,color:0x4cc9a5,power:82},
 {id:"vortex",name:"VORTEX",flag:"🛰️",x:.66,y:.31,color:0xf08a5d,power:91},
 {id:"usa",name:"USA",flag:"🇺🇸",x:.22,y:.47,color:0x65a7ff,power:96},
 {id:"orion",name:"ORION",flag:"🌙",x:.72,y:.52,color:0xd27cff,power:74},
 {id:"terra",name:"TERRA",flag:"🌍",x:.55,y:.68,color:0x78d36d,power:88}
];
let game;
let markers=[];

function $(id){return document.getElementById(id)}
function toast(text){const el=$("toast");el.textContent=text;el.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove("show"),2200)}
function render(){
 $("money").textContent=Math.floor(state.money);
 $("oil").textContent=Math.floor(state.oil);
 $("industry").textContent=Math.floor(state.industry);
 Object.entries(state.army).forEach(([k,v])=>$(k).textContent=Math.floor(v));
}
function renderCountries(){
 $("countries").innerHTML=countries.map(c=>`<div class="country ${state.selected===c.id?"active":""}" data-country="${c.id}"><b>${c.flag} ${c.name}</b><small>قدرت راهبردی: ${c.power}</small></div>`).join("");
 document.querySelectorAll("[data-country]").forEach(el=>el.onclick=()=>selectCountry(el.dataset.country));
}
function selectCountry(id){
 state.selected=id; const c=countries.find(x=>x.id===id);
 $("operation").innerHTML=`<b>${c.flag} ${c.name}</b><br>قدرت: ${c.power}<br><span>وضعیت: ${id==="sitin"?"متحد خودت":"قابل تعامل"}</span>`;
 renderCountries(); markers.forEach(m=>m.setScale(m.country.id===id?1.3:1));
}
function save(){localStorage.setItem(SAVE_KEY,JSON.stringify(state));toast("بازی ذخیره شد ✓")}
function load(){const raw=localStorage.getItem(SAVE_KEY);if(!raw){toast("ذخیره‌ای پیدا نشد");return}Object.assign(state,JSON.parse(raw));render();renderCountries();toast("بازی بارگذاری شد ✓")}
function act(action){
 if(action==="train"){
  if(state.money<80){toast("بودجه کافی نیست");return}
  state.money-=80; state.army.infantry+=40; state.industry+=1; toast("۴۰ نیروی جدید آموزش دیدند");
 }
 if(action==="industry"){
  if(state.money<150){toast("بودجه کافی نیست");return}
  state.money-=150;state.industry+=8;state.income+=5;toast("صنعت توسعه یافت؛ درآمد دوره‌ای افزایش یافت");
 }
 if(action==="mission"){
  if(state.oil<40){toast("نفت کافی نیست");return}
  state.oil-=40;state.money+=120;toast("مأموریت ملی با موفقیت انجام شد +$120");$("news").textContent="خبر: مأموریت SITIN با موفقیت پایان یافت.";
 }
 if(action==="deploy"){
  if(state.army.infantry<20){toast("نیروی کافی برای استقرار نیست");return}
  state.army.infantry-=20;state.deployed+=20;toast("۲۰ واحد به منطقه انتخاب‌شده اعزام شد");
 }
 render();
}
function battle(){
 if(!state.selected||state.selected==="sitin"){toast("اول یک کشور را انتخاب کن");return}
 const c=countries.find(x=>x.id===state.selected);const chance=state.army.infantry+state.army.armor*.8+state.army.air*1.2+state.army.navy*.5;
 const enemy=c.power*12; const win=chance>=enemy || Math.random()>.48;
 state.oil=Math.max(0,state.oil-35);state.money=Math.max(0,state.money-50);
 if(win){state.money+=220;state.industry+=3;toast(`عملیات علیه ${c.name} پیروز شد +$220`);$("news").textContent=`خبر فوری: SITIN در عملیات مقابل ${c.name} موفق شد.`}
 else{state.army.infantry=Math.max(0,state.army.infantry-35);state.armor=Math.max(0,state.army.armor-8);toast(`عملیات مقابل ${c.name} شکست خورد`);$("news").textContent=`خبر: عملیات مقابل ${c.name} بدون نتیجه پایان یافت.`}
 render();
}
function bootGame(){
 const config={type:Phaser.AUTO,parent:"game",backgroundColor:"#071827",scale:{mode:Phaser.Scale.RESIZE,width:"100%",height:"100%"},scene:{create,update}};
 game=new Phaser.Game(config);
}
function create(){
 const scene=this;scene.cameras.main.setBackgroundColor("#071827");
 drawMap(scene);drawMarkers(scene);
 window.addEventListener("resize",()=>{scene.time.delayedCall(80,()=>{scene.children.removeAll();drawMap(scene);drawMarkers(scene)})});
}
function drawMap(scene){
 const w=scene.scale.width,h=scene.scale.height;
 const g=scene.add.graphics();
 g.fillStyle(0x0b2133,1);g.fillRect(0,0,w,h);
 // abstract continents for a readable strategy-map look
 const shapes=[
  [[.08,.27],[.20,.19],[.31,.23],[.34,.36],[.26,.47],[.13,.44]],
  [[.40,.18],[.57,.12],[.68,.20],[.64,.34],[.52,.38],[.43,.31]],
  [[.70,.18],[.91,.23],[.96,.39],[.85,.46],[.73,.39]],
  [[.40,.45],[.54,.43],[.60,.56],[.56,.76],[.46,.85],[.38,.67]],
  [[.67,.51],[.83,.50],[.90,.65],[.82,.80],[.69,.72]]
 ];
 shapes.forEach((poly,i)=>{g.fillStyle([0x123047,0x153a4c,0x183b47,0x13354a,0x17394b][i],1);g.beginPath();poly.forEach((p,j)=>{const x=p[0]*w,y=p[1]*h;j?g.lineTo(x,y):g.moveTo(x,y)});g.closePath();g.fillPath();g.lineStyle(1,0x2a5269,.8);g.strokePath()});
 for(let x=0;x<w;x+=70){g.lineStyle(1,0x183449,.35);g.lineBetween(x,0,x,h)}
 for(let y=0;y<h;y+=70){g.lineStyle(1,0x183449,.35);g.lineBetween(0,y,w,y)}
}
function drawMarkers(scene){
 markers=[];const w=scene.scale.width,h=scene.scale.height;
 countries.forEach(c=>{
  const container=scene.add.container(c.x*w,c.y*h);container.country=c;container.setSize(54,54);container.setInteractive(new Phaser.Geom.Circle(0,0,27),Phaser.Geom.Circle.Contains);
  const glow=scene.add.circle(0,0,26,c.color,.12);const dot=scene.add.circle(0,0,15,c.color,.95);const ring=scene.add.circle(0,0,21,0x000000,0);ring.setStrokeStyle(2,c.color,.8);
  const label=scene.add.text(0,32,c.name,{fontFamily:"Tahoma,Arial",fontSize:"12px",fontStyle:"bold",color:"#eaf4ff"}).setOrigin(.5,0);
  container.add([glow,ring,dot,label]);container.on("pointerdown",()=>selectCountry(c.id));
  scene.tweens.add({targets:glow,scale:1.25,alpha:.03,duration:1300,yoyo:true,repeat:-1});markers.push(container);
 });
}

document.addEventListener("DOMContentLoaded",()=>{
 render();renderCountries();bootGame();
 $("saveBtn").onclick=save;$("loadBtn").onclick=load;$("battleBtn").onclick=battle;
 document.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>act(b.dataset.action));
 setInterval(()=>{state.tick++;state.money+=state.income;state.oil+=2;render()},30000);
});

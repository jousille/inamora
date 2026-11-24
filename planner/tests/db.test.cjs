const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/db.js'),'utf8');
function setup(){
 const store=new Map();
 const localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k),key:i=>[...store.keys()][i],get length(){return store.size}};
 const ctx=vm.createContext({localStorage});
 const db=vm.runInContext(source+'\nDB',ctx);
 db.init('TEST');
 db.setMeta({startDate:'2020-11-23'});
 db.saveHabits([{id:1,name:'Walk',sphereId:'energy',energy:3,createdOn:'2020-11-23'}]);
 return {db,store};
}
test('legacy Sunday and Monday keys are read, toggle is reversible and original preserved',()=>{
 const {db,store}=setup();
 const key='planer_TEST_comp_2020-11-22';
 const raw=JSON.stringify({1:[true,false,false,false,false,false,false]});
 store.set(key,raw);
 assert.equal(db.getHabitsEnergyForDate('2020-11-23'),3);
 db.saveTasks(1,1,[{name:'Work',score:-5}]);
 assert.equal(db.getDayScore(1,1),-2);
 assert.equal(db.getWeekScore(1),-2);
 assert.equal(db.getHabitsSphereStats().energy.done,1);
 assert.equal(db.getMonthDonors()[0].name,'Walk');
 db.toggleCompletionByDate(1,'2020-11-23');
 assert.equal(db.getDayScore(1,1),-5);
 db.toggleCompletionByDate(1,'2020-11-23');
 assert.equal(db.getDayScore(1,1),-2);
 assert.equal(store.get(key),raw);
 db.archiveHabit(1);
 assert.equal(db.getDayScore(1,1),-2);
});
test('local dates and cycle boundaries',()=>{
 const {db}=setup();
 assert.equal(db.dateForDay(2,1),'2020-11-30');
 assert.equal(db.dateForDay(4,7),'2020-12-20');
 assert.equal(db.localDate(db.parseDate('2020-11-23')),'2020-11-23');
 db.saveHabits([{id:1,name:'Walk',sphereId:'energy',energy:3,createdOn:'2020-12-19'}]);
 db.toggleCompletionByDate(1,'2020-12-19');
 assert.equal(db.getHabitsSphereStats().energy.total,2);
 assert.equal(db.getHabitsSphereStats().energy.pct,50);
});
test('archive uses its own cycle start',()=>{
 const {db}=setup();
 db.toggleCompletionByDate(1,'2020-11-23');
 db.startNewMonth('2020-12-21');
 assert.equal(db.getDayScore(1,1,0),3);
 assert.equal(db.getDayScore(1,1),0);
});

test('zero energy habit is saved and counted without changing energy',()=>{
 const {db}=setup();
 db.addHabit({name:'Neutral',sphereId:'energy',energy:0});
 const h=db.getHabits().find(h=>h.name==='Neutral');
 assert.equal(h.energy,0);
 db.toggleCompletionByDate(h.id,db.localDate());
 assert.equal(db.getCompletionsForDate(db.localDate())[h.id],true);
 assert.equal(db.getHabitsEnergyForDate(db.localDate()),0);
});

test('task categories are optional, validated and preserve old records',()=>{
 const {db}=setup();
 db.saveTasks(1,1,[{id:1,name:'Old',score:-5}]);
 db.updateTask(1,1,1,{sphereId:'work'});
 assert.equal(db.getTasks(1,1)[0].sphereId,'work');
 db.updateTask(1,1,1,{sphereId:''});
 assert.equal(db.getTasks(1,1)[0].sphereId,null);
 db.addTask(1,1,'New',3,'growth');
 assert.equal(db.getTasks(1,1)[1].sphereId,'growth');
 assert.equal(db.getDayScore(1,1),-2);
});

test('sphere analytics reconcile with total including legacy tasks and archived habits',()=>{
 const {db}=setup();
 db.saveTasks(1,1,[{id:1,name:'Work',score:-5,sphereId:'work'},{id:2,name:'Old',score:3}]);
 db.toggleCompletionByDate(1,'2020-11-23');
 db.archiveHabit(1);
 const rows=db.getSphereEnergy(1,1);
 assert.equal(rows.reduce((a,r)=>a+r.total,0),db.getWeekScore(1));
 assert.equal(rows.find(r=>r.id==='energy').positive,3);
 assert.equal(rows.find(r=>r.id==='work').negative,5);
 assert.equal(rows.find(r=>r.id===null).total,3);
 db.startNewMonth('2020-12-21');
 assert.equal(db.getSphereEnergy(1,4,0).reduce((a,r)=>a+r.total,0),1);
});

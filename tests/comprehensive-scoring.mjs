import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {completedAge,educationApplicability,memberEducationApplicability,normalizeScores,mappedScore,scoreMappings}=require('../apps/backend/.tools/src/oversight/comprehensive-scoring.js');
const date='2026-09-30';
const member=(dob,status,extra={})=>({id:'member',birth_date:dob,profile_data:{education:status,age:70},...extra});
let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name);}
test('Completed age respects birthday and never accepts malformed dates',()=>{
 assert.equal(completedAge('2020-09-29',date),6);assert.equal(completedAge('2020-10-01',date),5);
 assert.equal(completedAge('2025-02-29',date),null);assert.equal(completedAge('2027-01-01',date),null);
 assert.equal(completedAge(null,date),null);
});
test('All completed ages 6 through 18 are eligible regardless of school status',()=>{
 for(let age=6;age<=18;age++)for(const status of ['GRADUATED','UNKNOWN','NOT_STUDYING'])assert.equal(memberEducationApplicability(member((2026-age)+'-09-28',status),date).state,'APPLICABLE');
 assert.equal(memberEducationApplicability(member('2007-09-30','NOT_STUDYING'),date).state,'NOT_APPLICABLE');
});
test('Current student is eligible at any age and without DOB',()=>{
 for(const dob of [null,'1990-01-01','2022-01-01'])for(const status of ['STUDYING','دانشجو','دانش‌آموز','در حال تحصیل'])assert.equal(memberEducationApplicability(member(dob,status),date).state,'APPLICABLE');
});
test('Dropout and risk apply through completed age 24, never solely at 25+',()=>{
 for(const status of ['DROPPED_OUT','NOT_ENROLLED','AT_RISK']){
  assert.equal(memberEducationApplicability(member('2001-10-01',status),date).state,'APPLICABLE');
  assert.equal(memberEducationApplicability(member('2001-09-30',status),date).state,'NOT_APPLICABLE');
  assert.equal(memberEducationApplicability(member('2021-09-30',status),date).state,'NOT_APPLICABLE');
 }
});
test('Known educational situation is usable without DOB; manual age is ignored',()=>{
 assert.equal(memberEducationApplicability(member(null,'DROPPED_OUT'),date).state,'APPLICABLE');
 assert.equal(memberEducationApplicability(member(null,'GRADUATED'),date).state,'NOT_APPLICABLE');
 assert.equal(memberEducationApplicability(member(null,'UNKNOWN'),date).state,'UNKNOWN');
 assert.equal(memberEducationApplicability(member(null,'UNKNOWN'),date).age,null);
});
test('Missing or unrecognized base status and missing DOB never produce N/A',()=>{
 for(const status of [null,'','نامشخص','legacy free text']){
  const result=educationApplicability([member(null,status)],date);
  assert.equal(result.state,'UNKNOWN');assert.deepEqual(result.unknownMemberIds,['member']);
 }
});
test('Inactive members do not affect applicability; unknown members remain visible alongside students',()=>{
 assert.equal(educationApplicability([member(null,'STUDYING',{active:false})],date).state,'NOT_APPLICABLE');
 const result=educationApplicability([member(null,'STUDYING'),member(null,'UNKNOWN',{id:'unknown'})],date);
 assert.equal(result.state,'APPLICABLE');assert.deepEqual(result.unknownMemberIds,['unknown']);
});
test('Education N/A is null and example 51/85 normalizes to 60',()=>{
 const result=normalizeScores({livelihood:30,health:20,housing:1,vulnerability:0,education:0},'NOT_APPLICABLE',true);
 assert.equal(result.applicableMaximum,85);assert.equal(result.rawTotal,51);
 assert.equal(result.normalizedScore,60);assert.equal(result.needLevel,'B');assert.equal(result.domainRawScores.education,null);
});
test('Need thresholds use unrounded precision at 25, 50 and 75',()=>{
 for(const [value,level] of [[24.999999,'D'],[25,'C'],[49.999999,'C'],[50,'B'],[74.999999,'B'],[75,'A']]){
  const scores={livelihood:Math.min(value,30),health:Math.max(0,Math.min(value-30,20)),housing:Math.max(0,Math.min(value-50,20)),vulnerability:Math.max(0,value-70),education:0};
  assert.equal(normalizeScores(scores,'APPLICABLE',true).needLevel,level);
 }
});
test('Incomplete, unknown applicability and invalid scores cannot classify',()=>{
 const scores={livelihood:0,health:0,housing:0,vulnerability:0,education:0};
 assert.equal(normalizeScores(scores,'UNKNOWN',true).needLevel,null);
 assert.equal(normalizeScores(scores,'APPLICABLE',false).needLevel,null);
 for(const value of [-1,31,NaN,Infinity,null])assert.equal(normalizeScores({...scores,livelihood:value},'APPLICABLE',true).needLevel,null);
});
test('New numeric mappings match specification and reject raw points/unknown',()=>{
 assert.deepEqual(scoreMappings.health,{functionalImpact:[0,2,5,8],treatmentGap:[0,2,5,6],financialPressure:[0,2,4,6]});
 assert.deepEqual(scoreMappings.livelihood.adequacy,[0,4,8,12,15]);
 assert.equal(mappedScore(scoreMappings.education.status,'OPTION_4'),15);
 for(const input of [15,'UNKNOWN','',null,'OPTION_5'])assert.equal(mappedScore(scoreMappings.education.status,input),null);
});


const {evaluateComprehensive,assessmentTarget,alertDeadlineHours}=require('../apps/backend/.tools/src/oversight/comprehensive-scoring.js');
const baseline=()=>({
 livelihood:{adequacy:'OPTION_0',stability:'OPTION_0',essentialCosts:'OPTION_0',debt:'OPTION_0',incomeRange:'NONE',incomeSources:['SALARY'],mainIncomeSource:'SALARY',economicCapacity:'NO'},
 health:{members:[{memberId:'member',screening:'NO'}]},
 housing:{residenceType:'OWNER',problems:['NONE'],stability:'OPTION_0',qualitySafety:'OPTION_0',financialPressure:'OPTION_0',fit:'OPTION_0'},
 vulnerability:{dependency:'OPTION_0',socialRisk:'OPTION_0',risks:['NONE'],crisisType:'NONE'},
 education:{members:[]}
});
test('Complete N/A family scores zero over 85 with no irrelevant required questions',()=>{
 const result=evaluateComprehensive(baseline(),[member('1980-01-01','GRADUATED')],date);
 assert.equal(result.complete,true);assert.equal(result.domainRawScores.education,null);
 assert.equal(result.applicableMaximum,85);assert.equal(result.normalizedScore,0);assert.equal(result.needLevel,'D');
 assert.equal(result.alerts.length,0);
});
test('All eligible students must screen and unknown status blocks classification',()=>{
 const b=baseline(),members=[member('2010-01-01','STUDYING')];
 let result=evaluateComprehensive(b,members,date);assert.equal(result.complete,false);assert.equal(result.needLevel,null);
 b.education.members=[{memberId:'member',status:'UNKNOWN'}];assert.equal(evaluateComprehensive(b,members,date).complete,false);
 b.education.members=[{memberId:'member',status:'OPTION_0'}];result=evaluateComprehensive(b,members,date);
 assert.equal(result.complete,true);assert.equal(result.applicableMaximum,100);
});
test('Health uses independent maxima and family pressure once, capped at twenty',()=>{
 const b=baseline(),members=[member('1980-01-01','GRADUATED'),member('1985-01-01','GRADUATED',{id:'second'})];
 b.health={members:[{memberId:'member',screening:'YES',issueType:'CHRONIC',functionalImpact:'OPTION_3',treatmentGap:'OPTION_0'},
 {memberId:'second',screening:'YES',issueType:'CHRONIC',functionalImpact:'OPTION_0',treatmentGap:'OPTION_3'}],financialPressure:'OPTION_3'};
 const result=evaluateComprehensive(b,members,date);
 assert.equal(result.complete,true);assert.equal(result.domainRawScores.health,20);
 assert.equal(result.summaries.health.affectedMembers,2);
 const alert=result.alerts.find(a=>a.severity==='CRITICAL');
 assert.equal(alert.memberId,'second');assert.equal(alert.sourceField,'treatmentGap');
 assert.equal(alert.target,assessmentTarget('health','treatmentGap','second'));
});
test('Unknown health never becomes a zero score; conditional details block',()=>{
 const b=baseline(),members=[member(null,'GRADUATED')];
 b.health.members=[{memberId:'member',screening:'UNKNOWN'}];
 let result=evaluateComprehensive(b,members,date);
 assert.equal(result.domainRawScores.health,null);assert.equal(result.needLevel,null);
 b.health.members=[{memberId:'member',screening:'YES'}];
 result=evaluateComprehensive(b,members,date);assert.equal(result.complete,false);
 assert.ok(result.missing.some(m=>m.field==='issueType'));
});
test('Education takes the highest member score, not a sum',()=>{
 const b=baseline(),members=[member('2010-01-01','STUDYING'),member('2012-01-01','STUDYING',{id:'second'})];
 b.health.members.push({memberId:'second',screening:'NO'});
 b.education.members=[{memberId:'member',status:'OPTION_4',barrier:'COST',support:'SUPPLIES'},{memberId:'second',status:'OPTION_3',barrier:'COST',support:'SUPPLIES'}];
 const result=evaluateComprehensive(b,members,date);
 assert.equal(result.complete,true);assert.equal(result.domainRawScores.education,15);
 assert.equal(result.summaries.education.affectedMembers,2);
});
test('Alerts have stable source identity, exact targets and centralized deadlines',()=>{
 const b=baseline(),members=[member('1980-01-01','GRADUATED')];b.housing.stability='OPTION_3';
 const a=evaluateComprehensive(b,members,date),again=evaluateComprehensive(b,members,date);
 assert.deepEqual(a.alerts,again.alerts);assert.equal(a.alerts[0].severity,'URGENT');
 assert.equal(a.alerts[0].target,'housing-stability');
 b.housing.stability='OPTION_0';assert.equal(evaluateComprehensive(b,members,date).alerts.length,0);
 assert.deepEqual(alertDeadlineHours,{ATTENTION:168,URGENT:72,CRITICAL:24});
});
test('An unknown member prevents completion even with a known student',()=>{
 const b=baseline(),members=[member('2010-01-01','STUDYING'),member(null,null,{id:'unknown'})];
 b.health.members.push({memberId:'unknown',screening:'NO'});b.education.members=[{memberId:'member',status:'OPTION_0'}];
 const result=evaluateComprehensive(b,members,date);
 assert.equal(result.educationApplicability.state,'APPLICABLE');assert.equal(result.needLevel,null);
 assert.ok(result.missing.some(m=>m.memberId==='unknown'&&m.field==='applicability'));
});
test('All five domain maxima are bounded and produce 100 / A',()=>{
 const b=baseline();b.livelihood={...b.livelihood,adequacy:'OPTION_4',stability:'OPTION_4',essentialCosts:'OPTION_4',pressures:['FOOD'],debt:'OPTION_4',debtType:'RENT'};
 b.health={members:[{memberId:'member',screening:'YES',issueType:'CHRONIC',functionalImpact:'OPTION_3',treatmentGap:'OPTION_3'}],financialPressure:'OPTION_3'};
 b.housing={...b.housing,stability:'OPTION_4',immediateDanger:true,qualitySafety:'OPTION_3',problems:['SAFETY'],financialPressure:'OPTION_3',fit:'OPTION_3'};
 b.vulnerability={dependency:'OPTION_3',dependentMembers:['member'],supportAvailability:'ABSENT',risks:['DEPENDENT'],immediateDanger:true,socialRisk:'OPTION_3',crisisType:'DEATH',crisis:'OPTION_3'};
 b.education={members:[{memberId:'member',status:'OPTION_4',barrier:'COST',support:'SUPPLIES'}]};
 const result=evaluateComprehensive(b,[member('2010-01-01','STUDYING')],date);
 assert.equal(result.complete,true,JSON.stringify(result.missing));assert.deepEqual(result.domainRawScores,{livelihood:30,health:20,housing:20,vulnerability:15,education:15});
 assert.equal(result.normalizedScore,100);assert.equal(result.needLevel,'A');
 assert.ok(result.alerts.some(a=>a.severity==='CRITICAL'));assert.ok(result.alerts.some(a=>a.severity==='URGENT'));assert.ok(result.alerts.some(a=>a.severity==='ATTENTION'));
});
test('Hidden conditional values do not generate alerts or missing OTHER notes',()=>{
 const b=baseline();b.vulnerability.immediateDanger=true;b.livelihood.debtType='OTHER';
 const r=evaluateComprehensive(b,[member(null,'GRADUATED')],date);
 assert.equal(r.complete,true,JSON.stringify(r.missing));assert.equal(r.alerts.length,0);
});
test('Invalid choices, malformed lists and contradictory none selections block',()=>{
 for(const value of ['malformed',['NONE','SAFETY'],['not-an-option']]){
  const b=baseline();b.housing.problems=value;
  assert.equal(evaluateComprehensive(b,[member(null,'GRADUATED')],date).complete,false);
 }
});
test('Conditional OTHER requires its note only while selected',()=>{
 const b=baseline();b.housing.residenceType='OTHER';
 assert.equal(evaluateComprehensive(b,[member(null,'GRADUATED')],date).complete,false);
 b.housing.residenceTypeOther='Temporary arrangement';
 assert.equal(evaluateComprehensive(b,[member(null,'GRADUATED')],date).complete,true);
});
test('Empty active membership cannot produce a complete assessment',()=>{
 assert.equal(evaluateComprehensive(baseline(),[],date).complete,false);
});
test('N/A normalization classifies before display rounding',()=>{
 const r=normalizeScores({livelihood:30,health:12.49999999,housing:0,vulnerability:0,education:null},'NOT_APPLICABLE',true);
 assert.equal(Number(r.normalizedScore.toFixed(2)),50);assert.equal(r.needLevel,'C');
});
console.log('TOTAL '+count+' PASS, 0 FAIL');

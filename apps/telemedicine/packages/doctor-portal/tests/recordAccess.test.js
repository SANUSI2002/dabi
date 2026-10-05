import {test} from 'node:test';
import assert from 'node:assert/strict';
const local=new Map(),session=new Map();
globalThis.localStorage={getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,v)};
globalThis.window={localStorage,sessionStorage:{getItem:k=>session.get(k)??null,setItem:(k,v)=>session.set(k,v)},addEventListener:()=>{}};
const identity=await import('../src/store/doctorSession.js');
const appts=await import('../src/store/doctorAppointmentStore.js');
const access=await import('../src/store/recordAccessStore.js');
const records=await import('../src/services/patientRecord.js');
const assistant=await import('../src/services/portalAssistant.js');
identity.selectDemoDoctor('doctor-verma');
const appt=appts.getDoctorAppointments().find(a=>a.patientName==='Eleanor Vance');
appts.acceptAppointment(appt.id);
const scope={patientId:access.recordPatientId(appt),patientName:appt.patientName,consultationId:appt.id};
test('record remains locked while pending; wrong patient cannot approve',()=>{
 assert.equal(access.canReadRecord(scope),false);
 const r=access.requestRecordAccess(scope);
 assert.equal(access.requestRecordAccess(scope).id,r.id);
 assert.throws(()=>records.readPatientRecord(scope));
 assert.throws(()=>access.decidePreviewAccess(r.id,'wrong-patient','granted',true));
 assert.equal(access.canReadRecord(scope),false);
});
test('record access and AI consent are separate, tied to doctor and consultation',()=>{
 const r=access.accessFor(scope);
 access.decidePreviewAccess(r.id,scope.patientId,'granted',false);
 assert.equal(access.canReadRecord(scope),true);
 assert.equal(access.canReadRecord(scope,true),false);
 assert.throws(()=>records.readPatientRecord(scope,true));
 assert.equal(records.readPatientRecord({...scope,patientName:'Michael Chen'}).patientName,'Eleanor Vance');
 assert.equal(access.canReadRecord({...scope,consultationId:'other'}),false);
 identity.selectDemoDoctor('doctor-jenkins');assert.equal(access.canReadRecord(scope),false);
 identity.selectDemoDoctor('doctor-verma');
});
test('revocation removes record and AI access; expired grants fail closed',()=>{
 access.decidePreviewAccess(access.accessFor(scope).id,scope.patientId,'revoked');
 assert.equal(access.canReadRecord(scope),false);
 const r=access.requestRecordAccess(scope);
 access.decidePreviewAccess(r.id,scope.patientId,'granted',true);
 assert.equal(access.canReadRecord(scope,true),true);
 assert.equal(access.canReadRecord(scope,true,r.expiresAt+1),false);
 const text=records.summarizeRecord(records.readPatientRecord(scope,true),'Is there a record of hypertension?');
 assert.match(text,/Stage 1 Essential Hypertension/);assert.match(text,/Source: dx-1/);
 assert.match(records.summarizeRecord(records.readPatientRecord(scope,true),'history of diabetes?'),/does not establish absence/);
 access.endRecordAccess(appt.id);assert.equal(access.canReadRecord(scope),false);
});
test('AI service never reads protected records without separate grant',async()=>{
 await assert.rejects(()=>assistant.askAssistant('Summarize patient record','/consultations',scope),/permission/);
 const context=assistant.assistantContext('/dashboard',null);
 assert.equal(JSON.stringify(context).includes('Eleanor'),false);
 assert.match(assistant.localAssistantReply('What is my schedule today?',context),/scheduled consultation/);
 const r=access.requestRecordAccess(scope);access.decidePreviewAccess(r.id,scope.patientId,'granted',true);
 appts.updateAppointment(appt.id,{status:'past'});
 assert.equal(access.canReadRecord(scope,true),false);
});
test('verified live accounts cannot use browser demo grants',()=>{
 identity.activateDoctorSession({id:'live-doctor',name:'Doctor Live',accountStatus:'active',emailVerified:true,licenceVerified:true});
 assert.equal(access.canReadRecord(scope),false);
 assert.throws(()=>access.requestRecordAccess(scope),/not connected/);
});

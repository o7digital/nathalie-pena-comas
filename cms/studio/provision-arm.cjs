// Run only inside the existing CRM API container. Capture stdout privately: it contains credentials.
// Uses the deployed subscription/pipeline services; never sends invitations or creates a Stripe checkout.
const { PrismaClient } = require('@prisma/client');
const { randomBytes } = require('node:crypto');
const bcrypt = require('bcrypt');
const path = require('node:path');
const { AdminService } = require(path.resolve('dist/admin/admin.service.js'));
const { PipelinesService } = require(path.resolve('dist/pipelines/pipelines.service.js'));
const { StagesService } = require(path.resolve('dist/stages/stages.service.js'));

const prisma = new PrismaClient();
async function provision() {
 const adminEmail=process.env.STUDIO_ADMIN_EMAIL?.trim().toLowerCase();
 const customerEmail=process.env.STUDIO_CUSTOMER_EMAIL?.trim().toLowerCase();
 const managerEmail=process.env.STUDIO_MANAGER_EMAIL?.trim().toLowerCase();
 if(process.env.STUDIO_CONFIRM_CUSTOMER!=='Nathalie Peña-Comas' || !adminEmail || !customerEmail || !managerEmail) throw new Error('Explicit Nathalie customer and account configuration required.');
 const owner=await prisma.user.findUnique({where:{email:adminEmail},select:{id:true,email:true,role:true,tenantId:true}});
 if(!owner || owner.role!=='OWNER') throw new Error('The configured provisional administrator must already own a CRM account.');
 const manager=await prisma.user.findUnique({where:{email:managerEmail},select:{id:true,email:true,role:true,tenantId:true}});
 if(!manager || manager.role!=='OWNER' || !(await prisma.subscription.count({where:{tenantId:manager.tenantId}}))) throw new Error('Use the existing subscription management workspace.');
 const admin=new AdminService(prisma);
 const actor={userId:manager.id,tenantId:manager.tenantId,email:manager.email};
 const matches=await prisma.subscription.findMany({where:{OR:[{conciergeClientCode:'nathalie'},{contactEmail:customerEmail},{customerName:{equals:'Nathalie Peña-Comas',mode:'insensitive'}}]}});
 if(matches.length>1) throw new Error('Multiple matching subscriptions; inspect before provisioning.');
 let subscription=matches[0];
 if(subscription && (![manager.tenantId,owner.tenantId].includes(subscription.tenantId) || subscription.status!=='ACTIVE')) throw new Error('Existing subscription needs manual inspection.');
 if(!subscription) {
  subscription=await admin.createSubscription({customerName:'Nathalie Peña-Comas',contactFirstName:'Nathalie',contactLastName:'Peña-Comas',contactEmail:customerEmail,plan:'PULSE_TEAM',seats:30,crmMode:'B2B',industry:'Performing arts',conciergeEnabled:true,conciergeClientCode:'nathalie',conciergeSiteUrl:'https://nathalie-pena-comas.vercel.app'},actor);
 }
 if(subscription.stripeSubscriptionId || subscription.stripeCustomerId) throw new Error('Existing billing connection requires inspection.');
 const includedUntil=subscription.currentPeriodEnd?new Date(subscription.currentPeriodEnd):new Date(subscription.createdAt);
 if(!subscription.currentPeriodEnd) includedUntil.setUTCFullYear(includedUntil.getUTCFullYear()+1);
 // The existing admin DTO cannot set a non-Stripe period or bootstrap a first owner subscription.
 // Assign only this new customer subscription to the designated administrator's existing workspace.
 await prisma.subscription.update({where:{id:subscription.id},data:{tenantId:owner.tenantId,currentPeriodEnd:includedUntil,billingEmail:adminEmail,cancelAtPeriodEnd:false}});
 const tenantId=subscription.customerTenantId;
 await prisma.tenant.update({where:{id:tenantId},data:{crmDisplayCurrency:'EUR'}});
 const [local,domain]=adminEmail.split('@');
 const serviceEmail=`${local}+studio-${tenantId.slice(0,12)}@${domain}`;
 let connector=await prisma.user.findUnique({where:{email:serviceEmail},select:{id:true,name:true,tenantId:true,role:true}});
 if(connector && (connector.tenantId!==tenantId || connector.name!=='Nathalie Studio connector' || connector.role!=='ADMIN')) throw new Error('Connector identity collision.');
 const servicePassword=randomBytes(36).toString('base64url');
 const password=await bcrypt.hash(servicePassword,10);
 if(connector) await prisma.user.update({where:{id:connector.id},data:{password}});
 else connector=await prisma.user.create({data:{email:serviceEmail,name:'Nathalie Studio connector',tenantId,role:'ADMIN',password},select:{id:true}});
 const customerActor={userId:connector.id,tenantId,email:serviceEmail};
 const pipelines=new PipelinesService(prisma),stages=new StagesService(prisma);
 let pipeline=await prisma.pipeline.findFirst({where:{tenantId,name:'Agenda artística'}});
 if(!pipeline) pipeline=await pipelines.create({name:'Agenda artística',isDefault:true},customerActor);
 const definitions=[['Nueva propuesta','OPEN',0.1],['En conversación','OPEN',0.35],['Propuesta enviada','OPEN',0.6],['Confirmada','WON',1],['No concretada','LOST',0]];
 for(const [position,[name,status,probability]] of definitions.entries()) {
  if(!(await prisma.stage.findFirst({where:{tenantId,pipelineId:pipeline.id,name}}))) await stages.create({name,status,probability,position,pipelineId:pipeline.id},customerActor);
 }
 return {subscriptionId:subscription.id,tenantId,plan:subscription.plan,seats:subscription.seats,includedUntil:includedUntil.toISOString(),renewal:'manual',adminEmail,customerEmail,serviceEmail,servicePassword,pipelineId:pipeline.id};
}
provision().then(value=>process.stdout.write(JSON.stringify(value))).catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>prisma.$disconnect());

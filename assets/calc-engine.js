(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.ElectroEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SQRT3=Math.sqrt(3);
  const MATERIALS={
    copper:{name:'Koper',rho20:0.0175,alpha:0.00393},
    aluminum:{name:'Aluminium',rho20:0.0282,alpha:0.00403}
  };
  function finite(v){return typeof v==='number'&&Number.isFinite(v);}  
  function pos(v){return finite(v)&&v>0;}
  function clamp(v,min,max){return Math.min(max,Math.max(min,v));}
  function material(key){return MATERIALS[key]||MATERIALS.copper;}
  function pfOk(v){return pos(v)&&v<=1;}

  function singlePhasePower({voltage,current,pf=1}){
    if(!pos(voltage)||!pos(current)||!pfOk(pf)) throw new Error('Ongeldige invoer');
    const apparent=voltage*current; return {watts:apparent*pf,va:apparent};
  }
  function threePhasePower({voltage,current,pf=1}){
    if(!pos(voltage)||!pos(current)||!pfOk(pf)) throw new Error('Ongeldige invoer');
    const apparent=SQRT3*voltage*current; return {watts:apparent*pf,va:apparent};
  }
  function conductorResistance({materialKey='copper',length,area,temp=20}){
    if(!pos(length)||!pos(area)||!finite(temp)) throw new Error('Ongeldige invoer');
    const m=material(materialKey); const r20=m.rho20*length/area; const resistance=r20*(1+m.alpha*(temp-20));
    if(resistance<=0) throw new Error('Ongeldige temperatuur');
    return {ohm:resistance,ohm20:r20,rho20:m.rho20,material:m.name,temp};
  }
  function cableLengthFromResistance({materialKey='copper',resistance,area,temp=20,pathFactor=1}){
    if(!pos(resistance)||!pos(area)||!finite(temp)||!pos(pathFactor)) throw new Error('Ongeldige invoer');
    const m=material(materialKey); const rho=m.rho20*(1+m.alpha*(temp-20));
    const electricalLength=resistance*area/rho; return {length:electricalLength/pathFactor,electricalLength,rho,material:m.name};
  }
  function voltageDropSimple({phase=1,materialKey='copper',length,current,area,nominalVoltage,temp=20}){
    if(![1,3].includes(Number(phase))||!pos(length)||!pos(current)||!pos(area)||!pos(nominalVoltage)) throw new Error('Ongeldige invoer');
    const m=material(materialKey); const rho=m.rho20*(1+m.alpha*(temp-20));
    const factor=Number(phase)===1?2:SQRT3; const volts=factor*current*rho*length/area;
    return {volts,percent:volts/nominalVoltage*100,rho,material:m.name};
  }
  function voltageDropAC({phase=3,length,current,rOhmKm,xOhmKm,pf=1,nominalVoltage}){
    if(![1,3].includes(Number(phase))||!pos(length)||!pos(current)||!finite(rOhmKm)||rOhmKm<0||!finite(xOhmKm)||xOhmKm<0||!pfOk(pf)||!pos(nominalVoltage)) throw new Error('Ongeldige invoer');
    const sinPhi=Math.sqrt(Math.max(0,1-pf*pf)); const km=length/1000;
    const factor=Number(phase)===1?2:SQRT3;
    const volts=factor*current*km*(rOhmKm*pf+xOhmKm*sinPhi);
    return {volts,percent:volts/nominalVoltage*100,sinPhi};
  }
  function shortCircuit({voltage,impedance}){
    if(!pos(voltage)||!pos(impedance)) throw new Error('Ongeldige invoer');
    return {amps:voltage/impedance};
  }
  function powerTriangle({kw,pf}){
    if(!pos(kw)||!pfOk(pf)) throw new Error('Ongeldige invoer');
    const kva=kw/pf; const kvar=Math.sqrt(Math.max(0,kva*kva-kw*kw)); const phiDeg=Math.acos(pf)*180/Math.PI;
    return {kw,kva,kvar,phiDeg};
  }
  function powerFactorCorrection({kw,pfFrom,pfTo}){
    if(!pos(kw)||!pfOk(pfFrom)||!pfOk(pfTo)||pfTo<=pfFrom) throw new Error('Doel-cos φ moet hoger zijn dan de huidige cos φ');
    const phi1=Math.acos(pfFrom), phi2=Math.acos(pfTo); const kvar=kw*(Math.tan(phi1)-Math.tan(phi2));
    return {kvar,phiFrom:phi1*180/Math.PI,phiTo:phi2*180/Math.PI};
  }
  function phaseUnbalance({l1,l2,l3}){
    if(!pos(l1)||!pos(l2)||!pos(l3)) throw new Error('Ongeldige invoer');
    const avg=(l1+l2+l3)/3; const maxDev=Math.max(Math.abs(l1-avg),Math.abs(l2-avg),Math.abs(l3-avg));
    return {average:avg,maxDeviation:maxDev,percent:maxDev/avg*100};
  }
  function neutralCurrent({l1,l2,l3}){
    if(!finite(l1)||l1<0||!finite(l2)||l2<0||!finite(l3)||l3<0) throw new Error('Ongeldige invoer');
    const squared=l1*l1+l2*l2+l3*l3-l1*l2-l2*l3-l3*l1;
    return {amps:Math.sqrt(Math.max(0,squared))};
  }
  function transformerLoading({nominalKva,voltage,current}){
    if(!pos(nominalKva)||!pos(voltage)||!pos(current)) throw new Error('Ongeldige invoer');
    const kva=SQRT3*voltage*current/1000; return {kva,percent:kva/nominalKva*100};
  }
  function kvaCurrent({phase=3,kva,voltage}){
    if(![1,3].includes(Number(phase))||!pos(kva)||!pos(voltage)) throw new Error('Ongeldige invoer');
    const amps=(kva*1000)/(Number(phase)===1?voltage:SQRT3*voltage); return {amps};
  }
  function transformerBasics({kva,hvVoltage,lvVoltage,ukPercent=4}){
    if(!pos(kva)||!pos(hvVoltage)||!pos(lvVoltage)||!pos(ukPercent)) throw new Error('Ongeldige invoer');
    const hvCurrent=kva*1000/(SQRT3*hvVoltage);
    const lvCurrent=kva*1000/(SQRT3*lvVoltage);
    const ratio=hvVoltage/lvVoltage;
    const scLvCurrent=lvCurrent/(ukPercent/100);
    const zBaseLv=(lvVoltage*lvVoltage)/(kva*1000);
    const zEqLv=zBaseLv*(ukPercent/100);
    return {hvCurrent,lvCurrent,ratio,scLvCurrent,zBaseLv,zEqLv};
  }
  function transformerImpedanceFromUk({kva,voltage,ukPercent}){
    if(!pos(kva)||!pos(voltage)||!pos(ukPercent)) throw new Error('Ongeldige invoer');
    const ratedCurrent=kva*1000/(SQRT3*voltage);
    const zBase=(voltage*voltage)/(kva*1000);
    const impedance=zBase*(ukPercent/100);
    const shortCircuitCurrent=ratedCurrent/(ukPercent/100);
    return {ratedCurrent,zBase,impedance,shortCircuitCurrent};
  }

  function transformerTapEffect({hvNominal,lvNominal,supplyHv,tapPercent=0}){
    if(!pos(hvNominal)||!pos(lvNominal)||!pos(supplyHv)||!finite(tapPercent)||tapPercent<=-99) throw new Error('Ongeldige invoer');
    const tappedHvNominal=hvNominal*(1+tapPercent/100);
    const effectiveRatio=tappedHvNominal/lvNominal;
    const lvVoltage=supplyHv/effectiveRatio;
    return {tappedHvNominal,effectiveRatio,lvVoltage,deltaPercent:(lvVoltage/lvNominal-1)*100};
  }
  function transformerParallelShare({kva1,uk1,kva2,uk2,totalKva=0}){
    if(!pos(kva1)||!pos(uk1)||!pos(kva2)||!pos(uk2)||!finite(totalKva)||totalKva<0) throw new Error('Ongeldige invoer');
    const w1=kva1/uk1,w2=kva2/uk2,sum=w1+w2;
    const share1=w1/sum,share2=w2/sum;
    const load1=totalKva*share1,load2=totalKva*share2;
    return {share1,share2,load1,load2,loading1Percent:totalKva?load1/kva1*100:0,loading2Percent:totalKva?load2/kva2*100:0};
  }
  function motorCurrent3Phase({powerKw,voltage,pf=0.85,efficiency=0.9}){
    if(!pos(powerKw)||!pos(voltage)||!pfOk(pf)||!pfOk(efficiency)) throw new Error('Ongeldige invoer');
    const amps=powerKw*1000/(SQRT3*voltage*pf*efficiency);
    return {amps,inputKw:powerKw/efficiency};
  }
  function currentDensity({current,area,parallel=1}){
    if(!pos(current)||!pos(area)||!pos(parallel)) throw new Error('Ongeldige invoer');
    const perConductor=current/parallel; return {perConductor,density:perConductor/area};
  }
  function linePhaseValues({connection='star',lineVoltage,lineCurrent}){
    if(!['star','delta'].includes(connection)||!pos(lineVoltage)||!pos(lineCurrent)) throw new Error('Ongeldige invoer');
    if(connection==='star') return {phaseVoltage:lineVoltage/SQRT3,phaseCurrent:lineCurrent};
    return {phaseVoltage:lineVoltage,phaseCurrent:lineCurrent/SQRT3};
  }
  function frequencyPeriod({frequency}){
    if(!pos(frequency)) throw new Error('Ongeldige invoer');
    return {periodSeconds:1/frequency,periodMs:1000/frequency};
  }
  function energyCost({powerKw,hours,pricePerKwh=0}){
    if(!pos(powerKw)||!finite(hours)||hours<0||!finite(pricePerKwh)||pricePerKwh<0) throw new Error('Ongeldige invoer');
    const kwh=powerKw*hours; return {kwh,cost:kwh*pricePerKwh};
  }
  function tdrDistance({roundTripTimeUs,velocityMPerUs}){
    if(!pos(roundTripTimeUs)||!pos(velocityMPerUs)) throw new Error('Ongeldige invoer');
    return {distance:roundTripTimeUs*velocityMPerUs/2};
  }
  function capacitanceBreak({capA,capB,capPerKm}){
    if(!pos(capA)||!pos(capB)||!pos(capPerKm)) throw new Error('Ongeldige invoer');
    const totalCap=capA+capB; const totalLengthKm=totalCap/capPerKm; const fromAKm=capA/capPerKm; const percent=capA/totalCap*100;
    return {totalCap,totalLength:totalLengthKm*1000,fromA:fromAKm*1000,fromB:(capB/capPerKm)*1000,percent};
  }
  function leakageResistance({voltage,currentMilliAmp}){
    if(!pos(voltage)||!pos(currentMilliAmp)) throw new Error('Ongeldige invoer');
    const amps=currentMilliAmp/1000; return {ohm:voltage/amps,megaohm:(voltage/amps)/1e6};
  }
  function ohmsLaw({knownA,valueA,knownB,valueB}){
    const keys=['V','I','R','P']; if(!keys.includes(knownA)||!keys.includes(knownB)||knownA===knownB||!pos(valueA)||!pos(valueB)) throw new Error('Ongeldige invoer');
    const o={[knownA]:valueA,[knownB]:valueB};
    const pair=[knownA,knownB].sort().join('');
    if(pair==='IV'){o.R=o.V/o.I;o.P=o.V*o.I;}
    else if(pair==='RV'){o.I=o.V/o.R;o.P=o.V*o.I;}
    else if(pair==='PV'){o.I=o.P/o.V;o.R=o.V/o.I;}
    else if(pair==='IR'){o.V=o.I*o.R;o.P=o.V*o.I;}
    else if(pair==='IP'){o.V=o.P/o.I;o.R=o.V/o.I;}
    else if(pair==='PR'){o.I=Math.sqrt(o.P/o.R);o.V=o.I*o.R;}
    else throw new Error('Niet ondersteunde combinatie');
    return {voltage:o.V,current:o.I,resistance:o.R,power:o.P};
  }
  function loopFault({current,totalLoopVoltage,uv1,materialKey='copper',area}){
    if(!pos(current)||!pos(totalLoopVoltage)||!pos(uv1)||!pos(area)) throw new Error('Ongeldige invoer');
    const uv2=totalLoopVoltage/2-uv1; if(!finite(uv2)||uv2<0) throw new Error('Uv2 moet ≥ 0 zijn');
    const m=material(materialKey); const conductorVoltage=uv1+uv2; if(conductorVoltage<=0) throw new Error('Ongeldige spanningen');
    const conductorResistance=conductorVoltage/current; const totalLength=conductorResistance*area/m.rho20;
    const faultDistance=(uv1/conductorVoltage)*totalLength; const percent=totalLength?faultDistance/totalLength*100:0;
    return {uv2,conductorResistance,totalLength,faultDistance,percent:clamp(percent,0,100),material:m.name};
  }
  function directFault({current,u1,u2,materialKey='copper',area}){
    if(!pos(current)||!pos(u1)||!finite(u2)||u2<0||!pos(area)||u1<=u2) throw new Error('U1 moet groter zijn dan U2');
    const m=material(materialKey); const deltaU=u1-u2; const resistance=deltaU/current; const faultDistance=resistance*area/(2*m.rho20);
    return {deltaU,resistance,faultDistance,material:m.name};
  }

  function mod(n,m){return ((n%m)+m)%m;}
  function phasePermutationMap(sign,rotation){
    sign=Number(sign);rotation=Number(rotation);
    if(![1,-1].includes(sign)||![0,1,2].includes(rotation)) throw new Error('Ongeldige fasepermutatie');
    return [0,1,2].map(n=>mod(sign*n+rotation,3));
  }
  function phasePermutationScore(map){return map.reduce((sum,x,i)=>sum+Math.abs(x-i),0);}
  function effectiveClock({clock,hvSign=1,hvRotation=0,lvSign=1,lvRotation=0}){
    clock=Number(clock); if(!Number.isInteger(clock)||clock<0||clock>11||hvSign!==lvSign) return null;
    return hvSign===1?mod(clock+4*(lvRotation-hvRotation),12):mod(-clock+4*(hvRotation-lvRotation),12);
  }
  function phaseAlignmentSolve({targetClock,candidateClock}){
    targetClock=Number(targetClock);candidateClock=Number(candidateClock);
    if(!Number.isInteger(targetClock)||targetClock<0||targetClock>11||!Number.isInteger(candidateClock)||candidateClock<0||candidateClock>11) throw new Error('Ongeldig klokgetal');
    const solutions=[];
    for(const sign of [1,-1]) for(let hr=0;hr<3;hr++) for(let lr=0;lr<3;lr++){
      const hvMap=phasePermutationMap(sign,hr),lvMap=phasePermutationMap(sign,lr);
      const eff=effectiveClock({clock:candidateClock,hvSign:sign,hvRotation:hr,lvSign:sign,lvRotation:lr});
      if(eff!==targetClock)continue;
      const score=phasePermutationScore(hvMap)+phasePermutationScore(lvMap)+(sign===-1?8:0);
      solutions.push({hv:{sign,rotation:hr,map:hvMap},lv:{sign,rotation:lr,map:lvMap},effective:eff,score});
    }
    return solutions.sort((a,b)=>a.score-b.score)[0]||null;
  }

  function vectorGroup({hv='D',hvNeutral=false,lv='y',lvNeutral=true,clock=11}){
    const HV=['D','Y','Z']; const LV=['d','y','z']; clock=Number(clock);
    if(!HV.includes(hv)||!LV.includes(lv)||!Number.isInteger(clock)||clock<0||clock>11) throw new Error('Ongeldige vectorgroep');
    const hvPart=hv+((hv==='Y'||hv==='Z')&&hvNeutral?'N':'');
    const lvPart=lv+((lv==='y'||lv==='z')&&lvNeutral?'n':'');
    const signedShift=clock<=6 ? -clock*30 : (12-clock)*30;
    const direction=signedShift>0?'LV loopt voor op HV':signedShift<0?'LV loopt achter op HV':'Geen faseverschuiving';
    return {designation:`${hvPart}${lvPart}${clock}`,clock,signedShift,direction,clockDegrees:clock*30};
  }
  return {
    MATERIALS,SQRT3,singlePhasePower,threePhasePower,conductorResistance,cableLengthFromResistance,voltageDropSimple,voltageDropAC,shortCircuit,powerTriangle,powerFactorCorrection,phaseUnbalance,neutralCurrent,transformerLoading,kvaCurrent,transformerBasics,transformerImpedanceFromUk,transformerTapEffect,transformerParallelShare,motorCurrent3Phase,currentDensity,linePhaseValues,frequencyPeriod,energyCost,tdrDistance,capacitanceBreak,leakageResistance,ohmsLaw,loopFault,directFault,vectorGroup,phasePermutationMap,effectiveClock,phaseAlignmentSolve
  };
});

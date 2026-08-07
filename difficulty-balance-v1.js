(() => {
  'use strict';

  const BUILD='enemy-pressure-v3-20260807';

  // Keep HP unchanged in this tuning pass. The requested pressure increase comes from movement speed.
  const HP_MULT=[1.03,1.07,1.12,1.18,1.25];
  const SPEED_MULT=[1.08,1.13,1.19,1.25,1.32];
  const TYPE_HP_MULT={drone:1,runner:1,brute:1.06,shield:1.07,boss:1.12};
  const TYPE_SPEED_MULT={drone:1,runner:1.06,brute:1.02,shield:1.02,boss:1.04};

  // Cryo remains the dedicated movement-control tower, but the baseline slow is much lighter
  // and later enemies retain increasingly more of their movement speed while controlled.
  const CRYO_TUNING={slow:.24,slowDuration:1.15};
  const CONTROL_FLOOR=[.70,.74,.78,.82,.86];
  const TYPE_CONTROL_BONUS={drone:0,runner:0,brute:.04,shield:.06,boss:.10};

  // Wave composition and HP remain unchanged here; hands-on playtesting owns difficulty feel.
  const WAVE_PLAN=[
    [{type:'drone',count:9,gap:.58}],
    [{type:'runner',count:11,gap:.36},{type:'drone',count:6,gap:.40}],
    [{type:'brute',count:6,gap:.62},{type:'runner',count:13,gap:.27}],
    [{type:'shield',count:8,gap:.50},{type:'drone',count:14,gap:.22}],
    [{type:'runner',count:15,gap:.18},{type:'brute',count:8,gap:.34},{type:'shield',count:2,gap:.48},{type:'boss',count:1,gap:.90}]
  ];

  let game=null;
  let lastWave=-1;
  const baseSpeedByType=new Map();
  const seenEnemies=new WeakSet();

  function waveIndex(){
    return Math.max(0,Math.min(4,(game?.state?.wave||1)-1));
  }

  function installWavePlan(){
    if(!game?.level?.wavesData) return;
    game.level.wavesData.splice(
      0,
      game.level.wavesData.length,
      ...WAVE_PLAN.map(wave=>wave.map(group=>({...group})))
    );
  }

  function controlFloor(enemy,index=waveIndex()){
    return Math.min(.92,CONTROL_FLOOR[index]+(TYPE_CONTROL_BONUS[enemy?.type]||0));
  }

  function installCryoTuning(){
    const cryo=game?.towerTypes?.cryo;
    if(cryo){
      cryo.slow=CRYO_TUNING.slow;
      cryo.slowDuration=CRYO_TUNING.slowDuration;
    }
    for(const tower of game?.state?.towers||[]){
      if(tower?.type!=='cryo') continue;
      if(tower.__fusionBaseDef){
        tower.__fusionBaseDef.slow=CRYO_TUNING.slow;
        tower.__fusionBaseDef.slowDuration=CRYO_TUNING.slowDuration;
      }
      if(tower.def){
        tower.def.slow=CRYO_TUNING.slow;
        tower.def.slowDuration=CRYO_TUNING.slowDuration;
      }
    }
  }

  function installImpactPolicy(enemy){
    if(!enemy||enemy.__movementImpactPolicy==='cryo-only-v1') return;
    let rawImpact=Math.max(0,Number(enemy.impact)||0);
    Object.defineProperty(enemy,'impact',{
      configurable:true,
      enumerable:true,
      get(){return this.impactKind==='cryo'?rawImpact:0;},
      set(value){rawImpact=Math.max(0,Number(value)||0);}
    });
    enemy.__movementImpactPolicy='cryo-only-v1';
  }

  function tuneEnemy(enemy){
    if(!enemy) return;
    installImpactPolicy(enemy);
    if(seenEnemies.has(enemy)) return;
    seenEnemies.add(enemy);

    const index=waveIndex();
    const hpMultiplier=HP_MULT[index]*(TYPE_HP_MULT[enemy.type]||1);
    enemy.hp*=hpMultiplier;
    enemy.maxHp*=hpMultiplier;
    if(enemy.maxShield>0){
      enemy.shield*=hpMultiplier;
      enemy.maxShield*=hpMultiplier;
    }
    enemy.__difficultyMultiplier=hpMultiplier;
    enemy.__difficultyControlFloor=controlFloor(enemy,index);
    enemy.__difficultyBuild=BUILD;
  }

  function tuneSpeed(){
    const index=waveIndex();
    for(const enemy of game.state.enemies||[]){
      const def=enemy?.def;
      if(!def) continue;
      if(!baseSpeedByType.has(enemy.type)) baseSpeedByType.set(enemy.type,def.speed);
      const base=baseSpeedByType.get(enemy.type);
      def.speed=base*SPEED_MULT[index]*(TYPE_SPEED_MULT[enemy.type]||1);
    }
  }

  function tuneControl(){
    const index=waveIndex();
    for(const enemy of game.state.enemies||[]){
      if(!enemy||enemy.dead) continue;
      const floor=controlFloor(enemy,index);
      enemy.__difficultyControlFloor=floor;
      if(enemy.slow>0&&Number.isFinite(enemy.slowFactor)){
        enemy.slowFactor=Math.max(enemy.slowFactor,floor);
      }
    }
  }

  function publish(){
    const index=waveIndex();
    window.__DIFFICULTY_BALANCE={
      build:BUILD,
      ready:true,
      design:'faster-flow-cryo-only-hit-control',
      wave:game.state.wave,
      hpMultiplier:HP_MULT[index],
      speedMultiplier:SPEED_MULT[index],
      controlFloor:CONTROL_FLOOR[index],
      hpCurve:[...HP_MULT],
      speedCurve:[...SPEED_MULT],
      controlFloorCurve:[...CONTROL_FLOOR],
      cryoTuning:{...CRYO_TUNING},
      hitMovementPolicy:'cryo-only',
      hpCurveChanged:false,
      wavePlanChanged:false,
      typeHpMultiplier:{...TYPE_HP_MULT},
      typeSpeedMultiplier:{...TYPE_SPEED_MULT},
      typeControlBonus:{...TYPE_CONTROL_BONUS},
      wavePlan:WAVE_PLAN.map(wave=>wave.map(group=>({...group}))),
      activeEnemies:(game.state.enemies||[]).map(enemy=>({
        id:enemy.id,
        type:enemy.type,
        hp:enemy.hp,
        maxHp:enemy.maxHp,
        speed:enemy.def?.speed||0,
        slowFactor:enemy.slowFactor,
        controlFloor:enemy.__difficultyControlFloor,
        impact:enemy.impact,
        impactKind:enemy.impactKind,
        movementImpactPolicy:enemy.__movementImpactPolicy,
        appliedHpMultiplier:enemy.__difficultyMultiplier||1
      }))
    };
  }

  function frame(){
    if(game.state.wave!==lastWave){
      lastWave=game.state.wave;
      tuneSpeed();
    }
    installCryoTuning();
    for(const enemy of game.state.enemies||[]) tuneEnemy(enemy);
    tuneSpeed();
    tuneControl();
    publish();
    requestAnimationFrame(frame);
  }

  function install(){
    game=window.__NEON_TEST__;
    if(!game?.state||!game?.level?.wavesData||!game?.towerTypes) return false;
    installWavePlan();
    installCryoTuning();
    requestAnimationFrame(frame);
    return true;
  }

  let attempts=0;
  const timer=setInterval(()=>{
    attempts+=1;
    if(install()||attempts>600) clearInterval(timer);
  },25);
})();

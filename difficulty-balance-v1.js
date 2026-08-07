(() => {
  'use strict';

  const BUILD='enemy-pressure-v2-20260807';

  // Base wave scaling already exists in app.js (1.00, 1.24, 1.48, 1.72, 1.96).
  // Keep the extra HP curve controlled so difficulty comes from pressure and positioning,
  // not from turning late enemies into damage sponges.
  const HP_MULT=[1.03,1.07,1.12,1.18,1.25];
  const SPEED_MULT=[1.03,1.07,1.12,1.17,1.22];
  const TYPE_HP_MULT={drone:1,runner:1,brute:1.06,shield:1.07,boss:1.12};
  const TYPE_SPEED_MULT={drone:1,runner:1.06,brute:1.02,shield:1.02,boss:1.04};

  // Pressure is primarily created by tighter spacing and a few more high-threat bodies.
  // Rewards are intentionally unchanged: surviving pressure still funds the player's draft.
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

  function tuneEnemy(enemy){
    if(!enemy||seenEnemies.has(enemy)) return;
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

  function publish(){
    const index=waveIndex();
    window.__DIFFICULTY_BALANCE={
      build:BUILD,
      ready:true,
      design:'pressure-over-sponge',
      wave:game.state.wave,
      hpMultiplier:HP_MULT[index],
      speedMultiplier:SPEED_MULT[index],
      hpCurve:[...HP_MULT],
      speedCurve:[...SPEED_MULT],
      typeHpMultiplier:{...TYPE_HP_MULT},
      typeSpeedMultiplier:{...TYPE_SPEED_MULT},
      wavePlan:WAVE_PLAN.map(wave=>wave.map(group=>({...group}))),
      activeEnemies:(game.state.enemies||[]).map(enemy=>({
        id:enemy.id,
        type:enemy.type,
        hp:enemy.hp,
        maxHp:enemy.maxHp,
        speed:enemy.def?.speed||0,
        appliedHpMultiplier:enemy.__difficultyMultiplier||1
      }))
    };
  }

  function frame(){
    if(game.state.wave!==lastWave){
      lastWave=game.state.wave;
      tuneSpeed();
    }
    for(const enemy of game.state.enemies||[]) tuneEnemy(enemy);
    tuneSpeed();
    publish();
    requestAnimationFrame(frame);
  }

  function install(){
    game=window.__NEON_TEST__;
    if(!game?.state||!game?.level?.wavesData) return false;
    installWavePlan();
    requestAnimationFrame(frame);
    return true;
  }

  let attempts=0;
  const timer=setInterval(()=>{
    attempts+=1;
    if(install()||attempts>600) clearInterval(timer);
  },25);
})();

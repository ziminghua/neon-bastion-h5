(() => {
  'use strict';

  const BUILD='enemy-pressure-v1-20260807';
  const HP_MULT=[1.08,1.15,1.24,1.36,1.48];
  const SPEED_MULT=[1.03,1.06,1.09,1.12,1.16];
  const TYPE_HP_MULT={drone:1,runner:1,brute:1.06,shield:1.08,boss:1.18};
  const TYPE_SPEED_MULT={drone:1,runner:1.03,brute:1,shield:1,boss:1.02};

  let game=null;
  let lastWave=-1;
  const baseSpeedByType=new Map();
  const seenEnemies=new WeakSet();

  function waveIndex(){
    return Math.max(0,Math.min(4,(game?.state?.wave||1)-1));
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
      wave:game.state.wave,
      hpMultiplier:HP_MULT[index],
      speedMultiplier:SPEED_MULT[index],
      hpCurve:[...HP_MULT],
      speedCurve:[...SPEED_MULT],
      typeHpMultiplier:{...TYPE_HP_MULT},
      typeSpeedMultiplier:{...TYPE_SPEED_MULT},
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
    if(!game?.state) return false;
    requestAnimationFrame(frame);
    return true;
  }

  let attempts=0;
  const timer=setInterval(()=>{
    attempts+=1;
    if(install()||attempts>600) clearInterval(timer);
  },25);
})();

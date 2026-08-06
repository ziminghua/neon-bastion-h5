(() => {
  'use strict';
  const head=window.__RENDERED_MAP_DELIVERY_PARTS;
  const tail=window.__RENDERED_MAP_DELIVERY_TAIL;
  if(!Array.isArray(head)||typeof head[0]!=='string'||!Array.isArray(tail)||tail.slice(0,7).some(part=>typeof part!=='string'||!part.length)){
    window.__RENDERED_MAP_DELIVERY_ERROR='Delivery map parts are incomplete';
    return;
  }
  const assembled=head[0]+tail.slice(0,7).join('');
  window.__RENDERED_MAP_DELIVERY=assembled;
  window.__RENDERED_MAP_DELIVERY_DIAGNOSTICS={
    headLength:head[0].length,
    tailLengths:tail.slice(0,7).map(part=>part.length),
    assembledLength:assembled.length,
    expectedLength:86436
  };
})();

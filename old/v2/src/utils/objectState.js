export function snapshotObjectState(object) {
  return {
    x: object.x,
    y: object.y,
    scaleX: object.scale.x,
    scaleY: object.scale.y,
    rotation: object.rotation,
    alpha: object.alpha,
  };
}

export function applyObjectState(object, state) {
  object.position.set(state.x, state.y);
  object.scale.set(state.scaleX, state.scaleY);
  object.rotation = state.rotation;
  object.alpha = state.alpha;
}

export function objectStatesEqual(a, b) {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.scaleX === b.scaleX &&
    a.scaleY === b.scaleY &&
    a.rotation === b.rotation &&
    a.alpha === b.alpha
  );
}

import { updateQueue } from './component'

/**
 * 实现事件委托：react的合成事件
 * 在react中，事件并不是绑定在对应的dom上，而是经过处理，统一绑定在document上（react17后绑定在容器root上）
 * @param {*} dom
 * @param {*} eventType
 * @param {*} handler
 */
export function addEvent(dom, eventType, handler) {
  let store = {} // 存放此dom上对应的事件名称和事件处理函数
  if (dom.store) {
    store = dom.store
  } else {
    dom.store = {}
    store = dom.store
  }
  store[eventType] = handler // 例：store.onclick = handler

  // 防止多次往document绑定同样的事件
  if (!document[eventType]) {
    document[eventType] = dispatchEvent
  }
}

function dispatchEvent(event) {
  let { target, type } = event
  const eventType = `on${type}`
  updateQueue.isBatchingUpdate = true // 在react控制的事件中，切换为批量更新模式，此时的setState是异步的
  let syntheticEvent = createSyntheticEvent(event)

  // 模拟事件冒泡的过程
  while (target) {
    const { store } = target // target中的store就是在addEvent的时候加上的
    const handler = store && store[eventType] // 这样就能拿到在对应dom绑定的事件处理函数
    handler && handler.call(target, syntheticEvent)
    target = target.parentNode
  }

  // 合成事件的最后，isBatchingUpdate 重置为false
  // 所以自定义的事件、setTimeout、promise的回调，都不会命中批量更新了，此时的setState是同步的
  updateQueue.isBatchingUpdate = false
  updateQueue.batchUpdate()
}

// 在源码里，此处做了一些浏览器、平台的兼容和适配。为了跨平台开发
function createSyntheticEvent(event) {
  let syntheticEvent = {}
  for (let key in event) {
    syntheticEvent[key] = event[key]
  }
  return syntheticEvent
}

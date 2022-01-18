import { createDOM, updateProps } from './react-dom'
import {
  REACT_TEXT,
  REACT_PROVIDER,
  REACT_CONTEXT,
  REACT_MEMO,
} from './constants'
import { shallowEqual } from './utils'

export let updateQueue = {
  isBatchingUpdate: false, // 通过这个来控制是否是批量更新
  updaters: [],
  batchUpdate() {
    // 把所有待批量更新的执行
    for (let updater of updateQueue.updaters) {
      updater.updateComponent()
    }
    updateQueue.isBatchingUpdate = false
    updateQueue.updaters = []
  },
}

class Updater {
  constructor(classInstance) {
    this.classInstance = classInstance // 类组件的实例
    this.pendingStates = [] // 保存要更新state的队列
    this.callbacks = [] // 保存将要执行的回调函数
  }

  addState(partialState, callback) {
    this.pendingStates.push(partialState)
    if (typeof callback === 'function') {
      this.callbacks.push(callback)
    }
    this.emitUpdate() // 触发更新逻辑
  }

  // 不管是状态或是属性变化，都会让组件刷新
  emitUpdate(nextProps) {
    this.nextProps = nextProps

    // 如果当前命中批量更新，那么就把当前updater实例添加到updateQueue队列中
    if (updateQueue.isBatchingUpdate) {
      updateQueue.updaters.push(this)
    } else {
      this.updateComponent()
    }
  }

  updateComponent() {
    const { classInstance, pendingStates, nextProps } = this
    if (nextProps || pendingStates.length > 0) {
      // 说明有调用 setState 修改 state
      shouldUpdate(classInstance, nextProps, this.getState())
      this.callbacks.forEach((callback) => callback())
      this.callbacks = [] // 然后把 setState 的回调全部执行后，也清空 callbacks
    }
  }

  // 根据当前类组件旧的 state，和 pendingStates 这个更新队列中需要更新的 state，计算出最新的 state
  getState() {
    const { classInstance, pendingStates } = this
    let { state } = classInstance // 先获取到当前组件旧的 state
    pendingStates.forEach((nextState) => {
      // 调用 setState 的时候，可能传进来的是一个函数，这个函数接收旧的 state, 返回新的 state
      // 如: this.setState((state) => ({...newState}))
      if (typeof nextState === 'function') {
        nextState = nextState(state) // 如果是函数，把旧的 state 传进去，得到最新的 state
      }
      state = { ...state, ...nextState }
    })
    this.pendingStates = [] // 计算出最新的 state 后，清空pendingStates
    console.log('最新的state', state)
    return state
  }
}

function shouldUpdate(classInstance, nextProps, newState) {
  let willUpdate = true // 控制是否更新
  // react 生命周期函数 shouldComponentUpdate 控制组件是否更新，默认true为更新，返回false则不更新
  if (
    classInstance.shouldComponentUpdate && // 如果有 shouldComponentUpdate 方法
    !classInstance.shouldComponentUpdate(nextProps, newState) // 如果shouldComponentUpdate返回false，则不更新
  ) {
    willUpdate = false
  }

  // react 生命周期函数 componentWillUpdate 更新前
  if (willUpdate && classInstance.componentWillUpdate) {
    classInstance.componentWillUpdate()
  }

  // 如果有新的属性 props 则需要更新到最新的 props
  if (nextProps) {
    classInstance.props = nextProps
  }

  // reatc 新的静态生命周期函数 getDerivedStateFromProps，根据新的props派生新的state
  // 用于替换旧的 componentWillReceiveProps，
  // 因为有很多人在使用componentWillReceiveProps的时候，不做判断就直接调用this.setState，经常引起死循环
  if (classInstance.constructor.getDerivedStateFromProps) {
    const nextState = classInstance.constructor.getDerivedStateFromProps(
      nextProps,
      classInstance.state
    )
    if (nextState) {
      classInstance.state = nextState
    }
  } else {
    classInstance.state = newState // 得到最新的 state 后，更新类组件的 state
  }

  // 受 shouldComponentUpdate 影响，最后为true，才触发更新
  if (willUpdate) {
    classInstance.forceUpdate() // 然后调用类组件实例的 forceUpdate 进行更新
  }
}

/**
 * 根据vdom，获取对应的真实dom，用于组件更新
 * @param {*} vdom
 */
export function findDOM(vdom) {
  const { type } = vdom
  let dom
  if (typeof type === 'string' || type === REACT_TEXT) {
    dom = vdom.dom // 在 react-dom 中的 createDOM，在根据vdom 创建出对应是真实dom后，把真实dom挂在vdom上，所以这里可以取到真实dom
  } else {
    dom = findDOM(vdom.oldRenderElement) // 可能有多个组件嵌套，所以要递归
  }
  return dom
}

/**
 * 比较新旧虚拟DOM，找出差异，更新到真实DOM上
 * @param {*} parentNode
 * @param {*} oldVdom
 * @param {*} newVdom
 * const oldDom = oldVdom.dom // 跟 findDOM 获取真实dom 同理
   const newDom = createDOM(newVdom)
   parentNode.replaceChild(newDom, oldDom)
 */
export function compareTwoVdmo(parentNode, oldVdom, newVdom, nextDOM) {
  if (!oldVdom && !newVdom) {
    // 情况1. 新旧Vdom都没有，则不处理
  } else if (oldVdom && !newVdom) {
    // 情况2. 如果oldVdom存在，而newVdom不存在，代表需要移除组件
    const currentDOM = findDOM(oldVdom)
    currentDOM.parentNode.removeChild(currentDOM)

    // react 生命周期函数 componentWillUnmount 销毁组件
    if (oldVdom.classInstance && oldVdom.classInstance.componentWillUnmount) {
      oldVdom.classInstance.componentWillUnmount()
    }
  } else if (!oldVdom && newVdom) {
    // 情况3. 如果oldVdom不存在，而newVdom存在，代表需要 创建
    const newDOM = createDOM(newVdom)

    if (nextDOM) {
      parentNode.insertBefore(newDOM, nextDOM)
    } else {
      parentNode.appendChild(newDOM)
    }

    // 在创建dom后，判断一下新的dom有没有componentDidMount
    if (newDOM.componentDidMount) {
      newDOM.componentDidMount()
    }
  } else if (oldVdom && newVdom && oldVdom.type !== newVdom.type) {
    // 情况4. 新旧vdom都存在，但type不一样则不能复用，需要删除旧的，添加新的
    const oldDOM = findDOM(oldVdom)
    const newDOM = createDOM(newVdom)
    oldDOM.parentNode.replaceChild(newDOM, oldDOM)

    // 这里会销毁旧组件，如果旧组件是类组件，并且声明了componentWillUnmount，则需要调用
    if (oldVdom.classInstance && oldVdom.classInstance.componentWillUnmount) {
      oldVdom.classInstance.componentWillUnmount()
    }
    // 在替换dom后，判断一下新的dom有没有componentDidMount
    if (newDOM.componentDidMount) {
      newDOM.componentDidMount()
    }
  } else {
    // 情况5. 新旧vdom都存在，并且type一样，则需要复用旧的节点 dom-diff
    updateElement(oldVdom, newVdom)
  }
}

function updateElement(oldVdom, newVdom) {
  // 文本节点的更新
  if (oldVdom.type === REACT_TEXT && newVdom.type === REACT_TEXT) {
    // 让newVdom.dom = oldVdom.dom ---> 复用老的dom，如果文本内容不一样，只更新文本内容
    const currentDOM = (newVdom.dom = findDOM(oldVdom))
    if (newVdom.props.content) { // oldVdom.props.content !== newVdom.props.content
      currentDOM.textContent = newVdom.props.content
    }
  } else if (oldVdom.type && oldVdom.type.$$typeof === REACT_MEMO) {
    updateMemoComponent(oldVdom, newVdom)
  } else if (oldVdom.type && oldVdom.type.$$typeof === REACT_PROVIDER) {
    updateProviderComponent()
  } else if (oldVdom.type && oldVdom.type.$$typeof === REACT_CONTEXT) {
    updateConsumerComponent()
  } else if (typeof oldVdom.type === 'string') {
    // 让newVdom.dom = oldVdom.dom ---> 复用老的dom，只更新属性
    let currentDOM = (newVdom.dom = findDOM(oldVdom) || createDOM(oldVdom))
    // 用新的属性替换掉旧的属性
    updateProps(currentDOM, oldVdom.props, newVdom.props)
    updateChildren(currentDOM, oldVdom.props.children, newVdom.props.children)
  } else if (typeof oldVdom.type === 'function') {
    if (oldVdom.type.isReactComponent) {
      updateClassComponent(oldVdom, newVdom) // 类组件
    } else {
      updateFunctionComponent(oldVdom, newVdom) // 函数组件
    }
  }
}

function updateChildren(parentNode, oldVChildren, newVChildren) {
  oldVChildren = Array.isArray(oldVChildren) ? oldVChildren : [oldVChildren]
  newVChildren = Array.isArray(newVChildren) ? newVChildren : [newVChildren]
  const maxLength = Math.max(oldVChildren.length, newVChildren.length)
  for (let i = 0; i < maxLength; i += 1) {
    // 找到当前虚拟dom之后的最近的一个 vdom
    const nextVNode = oldVChildren.find(
      (item, index) => index > i && item && findDOM(item)
    )
    const nextDOM = nextVNode && findDOM(nextVNode)
    compareTwoVdmo(parentNode, oldVChildren[i], newVChildren[i], nextDOM)
  }
}

function updateMemoComponent(oldVdom, newVdom) {
  // prevProps是加载memo组件的时候加上的，这里更新的时候需要做新旧props的比较
  // type就是React.memo返回的 { compare: shallowEqual, $$typeof: REACT_MEMO, type: FunctionComponent }
  const { type, prevProps } = oldVdom
  if (type.compare(prevProps, newVdom.props)) {
    // 新旧props相等，则不更新，把旧的vdom赋值给新的就好了
    newVdom.oldRenderElement = oldVdom.oldRenderElement
    newVdom.prevProps = oldVdom.props
  } else {
    const parentNode = findDOM(oldVdom).parentNod
    const { type, props } = newVdom
    const renderElement = type.type(props)
    newVdom.prevProps = props
    newVdom.oldRenderElement = renderElement
    compareTwoVdmo(parentNode, oldVdom.oldRenderElement, renderElement)
  }
}

function updateProviderComponent(oldVdom, newVdom) {
  const parentNode = findDOM(oldVdom).parentNod
  const { type: ProviderComponent, props } = newVdom
  // 更新context的值
  ProviderComponent._context._currentValue = props.value
  const renderElement = ProviderComponent.children
  newVdom.oldRenderElement = renderElement
  compareTwoVdmo(parentNode, oldVdom.oldRenderElement, renderElement)
}

function updateConsumerComponent(oldVdom, newVdom) {
  const parentNode = findDOM(oldVdom).parentNod
  const { type: ConsumerComponent, props } = newVdom
  const renderElement = ConsumerComponent.children(props.value)
  newVdom.oldRenderElement = renderElement
  compareTwoVdmo(parentNode, oldVdom.oldRenderElement, renderElement)
}

// dom-diff 更新类组件
function updateClassComponent(oldVdom, newVdom) {
  // newVdom.classInstance = oldVdom.classInstance ---> 复用老的类组件实例
  const classInstance = (newVdom.classInstance = oldVdom.classInstance)
  newVdom.oldRenderElement = oldVdom.oldRenderElement // 复用老的vdom

  // react 生命周期函数 componentWillReceiveProps 组件更新前，接收最新的props，和旧的props
  // 可以在这个函数里做新旧props的比较，如果新旧props有差异，才调用this.setState，不然容易引起死循环
  if (classInstance && classInstance.componentWillReceiveProps) {
    classInstance.componentWillReceiveProps(newVdom.props, oldVdom.props)
  }
  // 调用类组件实例上的方法 emitUpdate, 触发更新并接收最新的props
  classInstance && classInstance.updater.emitUpdate(newVdom.props)
}

// dom-diff 更新函数组件
function updateFunctionComponent(oldVdom, newVdom) {
  const parentNode = findDOM(oldVdom).parentNode
  const { type: FunctionComponent, props } = newVdom
  const renderElement = FunctionComponent(props)
  newVdom.oldRenderElement = renderElement
  compareTwoVdmo(parentNode, oldVdom.oldRenderElement, renderElement)
}

export class Component {
  static isReactComponent = true
  constructor(props) {
    this.props = props
    this.state = {}

    // 每一个类组件的实例都有一个updater更新器
    this.updater = new Updater(this)
  }

  setState(partialState, callback) {
    this.updater.addState(partialState, callback)
  }

  /**
   * 组件的更新
   * 1. 获取旧的虚拟DOM
   * 2. 根据最新的props和state，计算出最新的虚拟DOM
   * 然后进行比较，查找出差异，然后更新真实的DOM
   */
  forceUpdate() {
    console.log('state更新，调用forceUpdate')
    const oldRenderElement = this.oldRenderElement
    const oldDOM = findDOM(oldRenderElement)

    // 除了在 createClassComponent 加载类组件的时候需要给context赋值
    // 在组件更新的时候，还要再更新一下最新的context
    if (this.constructor.contextType) {
      // 加载Provider的时候，已经把value赋值给了_currentValue
      this.context = this.constructor.contextType._currentValue
    }

    const newRenderElement = this.render()

    // react 生命周期函数  getSnapshotBeforeUpdate --> 获取更新前，前一次dom的快照
    // 返回值传会给 componentDidUpdate 的第三个参数
    let extraArgs = {}
    if (this.getSnapshotBeforeUpdate) {
      extraArgs = this.getSnapshotBeforeUpdate()
    }

    compareTwoVdmo(oldDOM.parentNode, oldRenderElement, newRenderElement) // 对比新旧vdom
    this.oldRenderElement = newRenderElement

    // react 生命周期函数 componentDidUpdate 更新完成
    if (this.componentDidUpdate) {
      this.componentDidUpdate(this.props, this.state, extraArgs)
    }
  }
}

// PureComponent 是针对类组件做的优化，其实就是定制了一个 shouldComponentUpdate，新旧props，state做了浅比较
// 如果是函数组件的话，那么就使用Rract.memo(FC, (prevProps, nextProps) => {
//    return shallowEqual(prevProps, nextProps) 也是做浅比较
// })
export class PureComponent extends Component {
  shouldComponentUpdate(nextProps, nextState) {
    return (
      !shallowEqual(this.props, nextProps) ||
      !shallowEqual(this.state, nextState)
    )
  }
}

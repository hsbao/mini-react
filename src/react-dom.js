import {
  REACT_TEXT,
  REACT_FORWARD_REF_TYPE,
  REACT_PROVIDER,
  REACT_CONTEXT,
  REACT_MEMO,
} from './constants'
import { wrapToVdom } from './utils'
import { addEvent } from './event'
import { compareTwoVdmo } from './component'

let hookState = []
let hookIndex = 0
let scheduleUpdate

/**
 * 把虚拟DOM转成真实的DOM，插入到容器中
 * @param {*} vdom 虚拟DOM
 * @param {*} container 容器
 */
function render(vdom, container) {
  mount(vdom, container)
  scheduleUpdate = () => {
    console.log('React.render  开始更新')
    // 因为重新更新的时候，会重新执行一遍hook
    // 所有要把hookIndex重置为0
    hookIndex = 0
    compareTwoVdmo(container, vdom, vdom)
  }
}

function mount(vdom, container) {
  const newDOM = createDOM(vdom)
  container.appendChild(newDOM)
  // react 生命周期函数 - componentDidMount 挂载完成
  if (newDOM.componentDidMount) {
    newDOM.componentDidMount()
  }
}

// function reducer(state, action) {
//   switch (action.type) {
//     case 'increment':
//       return {count: state.count + 1};
//     case 'decrement':
//       return {count: state.count - 1};
//     default:
//       throw new Error();
//   }
// }
// const [state, dispatch] = useReducer(reducer, { count: 0 })
// 修改：dispatch({type: 'decrement'})
// useState 的替代方案。它接收一个形如 (state, action) => newState 的 reducer，并返回当前的 state 以及与其配套的 dispatch 方法
export function useReducer(reducer, initialState) {
  if (!hookState[hookIndex]) {
    hookState[hookIndex] = initialState
  }
  const currentIndex = hookIndex
  function dispatch(action) {
    // reducer(hookState[currentIndex], action) 接收旧的state，根据action.type来修改state，返回新的state
    hookState[currentIndex] = reducer ? reducer(hookState[currentIndex], action) : action
    scheduleUpdate()
  }
  return [hookState[hookIndex++], dispatch]
}

export function useState(initialState) {
  hookState[hookIndex] = hookState[hookIndex] || initialState
  const currentIndex = hookIndex // 闭包(记录当前index，在setState里下次修改的时候。只改对应index的值)
  function setState(newState) {
    hookState[currentIndex] = newState
    console.log(hookState)
    scheduleUpdate() // 修改hooks state后触发更新操作
  }
  return [hookState[hookIndex++], setState]

  // return useReducer(null, initialState) 源码里其实是这样实现的，useState其实就是由useReducer得出
}

/**
 * 接收一个 context 对象（React.createContext 的返回值）并返回该 context 的当前值
 * 当前的 context 值由上层组件中距离当前组件最近的 <MyContext.Provider> 的 value prop 决定
 * @param {*} context 
 * @returns 
 */
export function useContext(context) {
  return context._currentValue
}

export function useRef() {
  if (hookState[hookIndex]) {
    return hookState[hookIndex++]
  } else {
    hookState[hookIndex] = { current: null }
    return hookState[hookIndex++]
  }
}

/**
 * useLayoutEffect 和 useEffect 实现原理类似
 * 区别：
 * 1. useLayoutEffect是一个微任务。并且是在渲染前执行的
 * 2. useEffect是一个宏任务，是在渲染后执行的
 * @param {*} callback 
 * @param {*} deps 
 */
export function useLayoutEffect(callback, deps) {
  if (hookState[hookIndex]) {
    const { destroy, oldDeps } = hookState[hookIndex]
    const everySame = deps.every((item, index) => item === oldDeps[index])
    if (everySame) {
      hookIndex++
    } else {
      destroy && destroy()
      queueMicrotask(() => {
        const destroy = callback()
        hookState[hookIndex++] = [destroy, deps]
      })
    }
  } else {
    queueMicrotask(() => {
      const destroy = callback()
      hookState[hookIndex++] = [destroy, deps]
    })
  }
}

/**
 * useEffect
 * @param {*} callback 当前渲染完成后，下一个宏任务
 * @param {*} deps 依赖数组，如果数组为空，则只会执行一次。如果数组里有依赖项，则只有依赖项发生变化后才会执行
 */
export function useEffect(callback, deps) {
  if (hookState[hookIndex]) {
    const [destroy, oldDeps] = hookState[hookIndex]
    const everySame = deps.every((item, index) => item === oldDeps[index])
    if (everySame) {
      hookIndex++
    } else {
      // useEffect 第一个参数是一个函数，如果这个函数有返回函数，那么这个返回的函数就是销毁函数
      // 这个销毁函数都是在下一次调用 useEffect 前触发执行
      destroy && destroy()
      setTimeout(() => {
        let destroy = callback()
        hookState[hookIndex++] = [destroy, deps]
      })
    }
  } else {
    // 初次渲染，开启一个宏任务。在宏任务里执行 useEffect 的 callback，然后保存销毁函数和依赖项
    setTimeout(() => {
      const destroy = callback()
      hookState[hookIndex++] = [destroy, deps]
    })
  }
}

// 把“创建”函数和依赖项数组作为参数传入 useMemo，它仅会在某个依赖项改变时才重新计算
// let data = React.useMemo(() => ({name: 'hongshibao'}), [name])
// 这样只有name发生变化，才会返回新的值
export function useMemo(factory, deps) {
  if (hookState[hookIndex]) { // 如果有值，然后要对比依赖项是否有发生变化
    const [oldMemo, oldDeps] = hookState[hookIndex]
    const everySame = deps.every((item, index) => item === oldDeps[index])
    if (everySame) { // 如果每一个依赖项都一样，说明没变，直接返回旧的
      hookIndex++
      return oldMemo
    } else { // 否则说明依赖项发生了变化，然后更新建一样的逻辑
      const newMemo = factory()
      hookState[hookIndex++] = [newMemo, deps]
      return newMemo
    }
  } else {
    const newMemo = factory() // 调用 useMemo 接收的第一个参数
    hookState[hookIndex++] = [newMemo, deps]
    return newMemo
  }
}

// 把内联回调函数及依赖项数组作为参数传入 useCallback, 跟上面的 useMemo 同理
// let callback = React.useCallback(() => setNumber(number + 1), [number])
export function useCallback(callback, deps) {
  if (hookState[hookIndex]) { // 如果有值，然后要对比依赖项是否有发生变化
    const [oldCallback, oldDeps] = hookState[hookIndex]
    const everySame = deps.every((item, index) => item === oldDeps[index])
    if (everySame) { // 如果每一个依赖项都一样，说明没变，直接返回旧的
      hookIndex++
      return oldCallback
    } else { // 否则说明依赖项发生了变化，然后更新建一样的逻辑
      hookState[hookIndex++] = [callback, deps]
      return callback
    }
  } else {
    hookState[hookIndex++] = [callback, deps]
    return callback
  }
}

/**
 * 把虚拟DOM转成真实的DOM
 * @param {*} vdom
 */
export function createDOM(vdom) {
  vdom = wrapToVdom(vdom)
  const { type, props, ref } = vdom
  let dom
  if (type && type.$$typeof === REACT_FORWARD_REF_TYPE) {
    // React.forwardRef 转发 ref
    return createForwardComponent(vdom)
  } else if (type && type.$$typeof === REACT_MEMO) {
    return createMemoComponent(vdom)
  } else if (type && type.$$typeof === REACT_PROVIDER) {
    return createProviderComponent(vdom)
  } else if (type && type.$$typeof === REACT_CONTEXT) {
    return createConsumerComponent(vdom)
  } else if (type === REACT_TEXT) {
    // 如果是一个本文类型的，就创建一个文本元素
    dom = document.createTextNode(props.content)
  } else if (typeof type === 'function') {
    if (type.isReactComponent) {
      return createClassComponent(vdom) // 处理自定义class组件
    } else {
      return createFunctionComponent(vdom) // 处理函数组件
    }
  } else {
    dom = document.createElement(type) // 创建原生DOM
  }

  if (props) {
    updateProps(dom, {}, props)
    if (typeof props.children === 'object' && props.children.type) {
      // 如果props.children是一个对象，并且有type，说明只有一个子节点
      // 那么直接渲染子节点插入当前dom中
      render(props.children, dom)
    } else if (Array.isArray(props.children)) {
      // 递归渲染子元素，并且插入当前dom中
      reconcileChildren(props.children, dom)
    } else if (props.children) {
      render(props.children, dom)
    }
  }

  // 不管是什么类型的元素，都让它的dom属性指向他创建出来的直实DOM元素
  vdom.dom = dom

  // 设置原生DOM的ref
  if (ref) {
    ref.current = dom
  }
  return dom
}

function createMemoComponent(vdom) {
  // type就是React.memo返回的 { compare, $$typeof: REACT_MEMO, type: FunctionComponent }
  const { type, props } = vdom
  const renderElement = type.type(props) // type.type才是那个函数组件
  vdom.prevProps = props // 为了更新的时候做新旧props的比较，如果新旧props一样，则不更新，反正才更新（性能优化）
  vdom.oldRenderElement = renderElement
  return createDOM(renderElement)
}

function createProviderComponent(vdom) {
  const { type: ProviderComponent, props } = vdom
  // 渲染Provider的时候，把接收到的value赋值给_currentValue
  ProviderComponent._context._currentValue = props.value
  // 渲染Provider的时候，其实就是渲染它的children
  const renderElement = props.children
  vdom.oldRenderElement = renderElement
  return createDOM(renderElement)
}

function createConsumerComponent(vdom) {
  const { type: ConsumerComponent, props } = vdom
  // 渲染Consumer的时候，其实就是渲染它的children，children是一个函数，接收context的值(就是Provider接收的value)
  const renderElement = props.children(ConsumerComponent._context._currentValue)
  vdom.oldRenderElement = renderElement
  return createDOM(renderElement)
}

/**
 * React.forwardRef 转发 ref
 * @param {*} dom
 */
function createForwardComponent(vdom) {
  const { type, props, ref } = vdom
  // React.forwardRef(FC) ---> {$$type: REACT_FORWARD_REF_TYPE, render: FunctionComponent }
  // 所以type.render对应的是那个函数组件
  const renderElement = type.render(props, ref)
  vdom.oldRenderElement = renderElement
  const newDOM = createDOM(vdom)
  vdom.dom = newDOM
  return newDOM
}

/**
 * 根据虚拟DOM中的属性，更新真实DOM的属性
 * @param {*} dom
 * @param {*} oldProps 旧的属性
 * @param {*} newProps 新的属性
 */
export function updateProps(dom, oldProps, newProps) {
  for (let key in newProps) {
    if (key === 'children') {
      // children单独处理，所以跳过
      continue
    }
    if (key === 'style') {
      const styles = newProps[key]
      for (let attr in styles) {
        dom.style[attr] = styles[attr]
      }
    } else if (key.startsWith('on')) {
      // 绑定事件
      // dom[key.toLocaleLowerCase()] = newProps[key] // dom.onclick = fn()
      addEvent(dom, key.toLocaleLowerCase(), newProps[key])
    } else {
      // className
      if (key) {
        dom[key] = newProps[key]
      }
    }
  }
}

/**
 * 遍历所有子元素的虚拟DOM，调用render，把虚拟DOM转成真实的DOM，并且插入到它们对应的父元素中
 * @param {*} childrenVdom
 * @param {*} parentNode
 */
function reconcileChildren(childrenVdom, parentNode) {
  for (let i = 0; i < childrenVdom.length; i += 1) {
    let childVdom = childrenVdom[i]
    render(childVdom, parentNode)
  }
}
/**
 * 处理React的class组件
 * @param {*} vdom
 */
function createClassComponent(vdom) {
  const { type: ClassComponent, props, ref } = vdom

  // react 类组件的默认属性 defaultProps
  let defaultProps = ClassComponent.defaultProps || {}
  const componentProps = { ...defaultProps, ...props }

  // type就是一个类，需要实例化这个类，调用实例上的render方法，返回虚拟dom
  const classComponentInstance = new ClassComponent(componentProps)

  // contextType是类的一个静态属性，会被重赋值为之前创建的context对象
  // TestContext = React.createContext()
  // 如：static contextType = TestContext
  // 这能让你直接使用 this.context 来消费最近 Context 上的那个值
  // 你可以在任何生命周期中访问到它，包括 render 函数中
  // 也就是在加载类组件的时候，如果设置了 静态属性 contextType，那么就把context对象赋值
  if (ClassComponent.contextType) {
    // 加载Provider的时候，已经把value赋值给了_currentValue
    classComponentInstance.context = ClassComponent.contextType._currentValue
  }

  // 把类组件的实例也挂载在当前vdom上，方便在组件更新 updateClassComponent 的时候调用
  vdom.classInstance = classComponentInstance

  // 设置类组件的ref
  if (ref) {
    ref.current = classComponentInstance
  }

  // react 生命周期函数 - componentWillMount 挂载前
  if (classComponentInstance.componentWillMount) {
    classComponentInstance.componentWillMount()
  }

  // react 生命周期函数 - render 渲染
  const renderElement = classComponentInstance.render()

  // 在类组件实例上添加 oldRenderElemen，指向上一次要渲染的虚拟DOM节点
  // 因为后面组件更新的，会重新 render，然后跟上一次的 oldRenderElemen 进行dom-diff
  classComponentInstance.oldRenderElement = vdom.oldRenderElement =
    renderElement
  let newDOM = createDOM(renderElement)
  renderElement.dom = newDOM // 同原生元素一样，把当前类组件render后得到的虚拟DOM的dom属性指向他创建出来的直实DOM元素

  // 暂时把 componentDidMount 方法挂到 dom 上, 在render的完成后，调用 dom.componentDidMount
  // 这样确保渲染dom完成后再调用 componentDidMount
  if (classComponentInstance.componentDidMount) {
    newDOM.componentDidMount = classComponentInstance.componentDidMount.bind(
      classComponentInstance
    )
  }

  return newDOM // 然后再把虚拟dom转成真实的dom
}

/**
 * 处理React的函数组件，接收 props ，返回 JSX （虚拟dom）
 * @param {*} vdom
 */
function createFunctionComponent(vdom) {
  const { type: functionComponent, props } = vdom
  // 如果是函数组件，type = functionComponent就是那个函数，并且这个函数接收props， 返回虚拟dom
  const renderElement = functionComponent(props)
  vdom.oldRenderElement = renderElement // 需要缓存，记录下旧的vdom，方便在组件更新的时候，做新旧vdom的比较
  let newDOM = createDOM(renderElement)
  //虚拟DOM的dom属性指向它创建出来的真实DOM
  renderElement.dom = newDOM //我们从虚拟DOMReact元素创建出真实DOM，创建出来以后会把真实DOM添加到虚拟DOM的dom属性上
  return newDOM
  //element.renderElement.dom=DIV真实DOM元素
}

const ReactDOM = {
  render,
}

export default ReactDOM

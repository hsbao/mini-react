import { wrapToVdom, shallowEqual } from './utils'
import { Component, PureComponent } from './component'
import {
  REACT_FORWARD_REF_TYPE,
  REACT_PROVIDER,
  REACT_CONTEXT,
  REACT_MEMO,
} from './constants'
import {
  useState,
  useMemo,
  useCallback,
  useReducer,
  useEffect,
  useContext
} from './react-dom'

/**
 *
 * @param {*} type
 * @param {*} config
 * @param {*} children 子节点，可能有多个
 */
function createElement(type, config, children) {
  if (config) {
    delete config.__source
    delete config.__self
  }
  let { key, ref, ...props } = config
  if (arguments.length > 3) {
    // 如果是多个子节点，转成数组
    props.children = Array.prototype.slice.call(arguments, 2).map(wrapToVdom)
  } else {
    props.children = wrapToVdom(children)
  }
  return {
    type,
    props,
    key,
    ref,
  }
}

function createRef() {
  return { current: null }
}

// forwardRef 返回一个对象
function forwardRef(FunctionComponent) {
  return {
    $$typeof: REACT_FORWARD_REF_TYPE,
    render: FunctionComponent,
  }
}

// function createContext(defaultValue) {
//   let context = { Provider, Consumer }
//   function Provider({ children, value }) {
//     context._value = value
//     return children
//   }
//   function Consumer(params) {}
//   return context
// }

function createContext(defaultValue) {
  let context = { $$typeof: REACT_CONTEXT }
  context.Provider = { $$typeof: REACT_PROVIDER, _context: context }
  context.Cunsumer = { $$typeof: REACT_CONTEXT, _context: context }
  context.Provider._context._currentValue = defaultValue
  return context
}

function memo(FunctionComponent, compare = shallowEqual) {
  return {
    compare,
    $$typeof: REACT_MEMO,
    type: FunctionComponent,
  }
}

const React = {
  createElement,
  Component,
  PureComponent,
  createRef,
  forwardRef,
  createContext,
  memo,
  useState,
  useMemo,
  useCallback,
  useReducer,
  useEffect,
  useContext
}

export default React

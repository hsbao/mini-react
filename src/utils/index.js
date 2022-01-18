import { REACT_TEXT } from '../constants'

function isReactText(element) {
  return typeof element === 'string' || typeof element === 'number'
}

/**
 * 不管原来是什么样的元素，都转成对象的形式，方便后面做DOM-DIFF
 * @param {*} element
 * @returns
 */
export const wrapToVdom = (element) => {
  // 如果是字符串、数字，也转成对象
  if (isReactText(element)) {
    return {
      type: REACT_TEXT,
      props: {
        content: element,
      },
    }
  } else {
    return element
  }

  // else if (
  //   element.props &&
  //   element.props.children &&
  //   isReactText(element.props.children)
  // ) {
  //   console.log('45678', wrapToVdom(element.props.children))
  //   element.props.children = wrapToVdom(element.props.children)
  // }
}

// 判断两个对象是否相等，浅比较
export const shallowEqual = (obj1 = {}, obj2 = {}) => {
  if (obj1 === obj2) {
    return true
  }
  if (
    typeof obj1 !== 'object' ||
    obj1 === null ||
    typeof obj2 !== 'object' ||
    obj2 === null
  ) {
    return false
  }
  const key1 = Object.keys(obj1)
  const key2 = Object.keys(obj2)
  if (key1.length !== key2.length) {
    return false
  }
  for (let key in key1) {
    if (!obj2.hasOwnProperty(key) || obj1[key] !== obj2[key]) {
      return false
    }
  }
  return true
}

import React from './react'
import ReactDOM from './react-dom'

function FunctionComponent(props, ref) {
  return React.createElement('h2', { ref }, 'hello，', props.name + props.num)
}

const testFC = React.forwardRef(FunctionComponent)

class ChildComponent extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      num: 0,
    }
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    return {
      num: nextProps.num1,
    }
  }

  render() {
    return React.createElement('h4', {}, 'childComponent：', this.state.num)
  }
}

/**
 * 类组件的数据来源有两个：1. 父组件传过来的属性props   2. 自己内部的状态state
 * 组件的属性和状态发生变化后，组件都会更新，视图重新渲染
 *
 */
class ClassComponent extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      num: 0,
    }

    this.testRef = React.createRef()
    this.fcRef = React.createRef()
  }

  handleClickBtn = () => {
    this.setState({ num: this.state.num + 1 }, () => {
      console.log('onClick111111', this.state.num)
    })
    // this.forceUpdate()
  }

  // componentWillMount() {
  //   console.log('componentWillMount')
  // }

  // getSnapshotBeforeUpdate() {
  //   return {
  //     test: 'getSnapshotBeforeUpdate',
  //   }
  // }

  render() {
    const h1 = React.createElement(
      'h1',
      { ref: this.testRef },
      'hello，',
      this.props.name
    )
    const p = React.createElement('p', {}, this.state.num)
    const button = React.createElement(
      'button',
      {
        onClick: this.handleClickBtn,
      },
      'on click'
    )

    const fc = React.createElement(testFC.render, {
      ref: this.fcRef,
      name: 'FC',
      num: this.state.num,
    })

    const cc = React.createElement(ChildComponent, { num1: this.state.num })
    // return (
    //   <div className="test">
    //     <h1>hello，{this.props.name}</h1>
    //     <p> { this.state.num } </p>
    //     <button onClick={ this.handleClickBtn }>on click</button>
    //   </div>
    // )
    return React.createElement(
      'div',
      { className: 'test' },
      h1,
      p,
      fc,
      cc,
      button
    )
  }

  // componentDidUpdate(prevProps, prevState, args3) {
  //   console.log('componentDidUpdate', args3)
  // }
}

const cel = React.createElement(ClassComponent, {
  name: 'hahaha1',
})

ReactDOM.render(cel, document.getElementById('root'))

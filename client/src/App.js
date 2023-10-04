import logo from './logo.svg';
import './App.css';

let Test = (props) => {
  return (
    <div key='5' text='hello kasper'>
      {props.children}
    </div>
  )
}

function App() {
  return (
    <Test key='1'>
      <div key='2' />
      <Test key='3'>
        <div key='4' />
      </Test>
    </Test>
  )
}

export default App;

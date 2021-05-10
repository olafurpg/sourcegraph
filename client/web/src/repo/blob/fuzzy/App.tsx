import "./App.css";
import { Modal } from "./Modal";
import { useLocalStorage } from "./useLocalStorage";

function App() {
  const [show, setShow] = useLocalStorage("fuzzy-files.isVisible", true);
  return (
    <div className="App">
      <button onClick={() => setShow(true)}>Find files</button>
      <Modal show={show} onClose={() => setShow(false)} />
    </div>
  );
}

export default App;

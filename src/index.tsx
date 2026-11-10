import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import ImageEditor from "./ImageEditor";
import Studio from "./studio/Studio";
import "./styles.css";

/** The music studio is the app; the original image editor stays available at #editor. */
function Root() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  if (hash === "#editor") {
    return (
      <div className="App">
        <p>
          <a href="#studio">&larr; Back to Breeze Studio</a>
        </p>
        <ImageEditor />
      </div>
    );
  }
  return <Studio />;
}

const rootElement = document.getElementById("root")!;
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);

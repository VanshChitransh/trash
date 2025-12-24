import React from "react";
import Routes from "./Routes";
import { NotificationProvider } from "./contexts/NotificationContext";

function App() {
  return (
    <NotificationProvider>
      <Routes />
    </NotificationProvider>
  );
}

export default App;

import { AppLayout } from "./components/layout/AppLayout";
import { NotificationToasts } from "./components/notifications";
import { useNotificationBridge } from "./hooks/useNotificationBridge";
import "./App.css";

function App() {
  useNotificationBridge();

  return (
    <>
      <AppLayout />
      <NotificationToasts />
    </>
  );
}

export default App;

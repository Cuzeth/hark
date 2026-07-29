import { Route, Routes } from "react-router";
import { DocumentMetadata } from "./components/DocumentMetadata";
import { CliAuthorize } from "./pages/CliAuthorize";
import { Dashboard } from "./pages/Dashboard";
import { Docs } from "./pages/Docs";
import { SignIn } from "./pages/SignIn";

export function App() {
  return (
    <>
      <DocumentMetadata />
      <Routes>
        <Route path="/" element={<SignIn />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/cli/authorize" element={<CliAuthorize />} />
        <Route path="/docs" element={<Docs />} />
      </Routes>
    </>
  );
}

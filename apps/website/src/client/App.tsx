import { Route, Routes } from "react-router";
import { DocumentMetadata } from "./components/DocumentMetadata";
import { CliAuthorize } from "./pages/CliAuthorize";
import { Dashboard } from "./pages/Dashboard";
import { Docs } from "./pages/Docs";
import { Landing } from "./pages/Landing";
import { Launched } from "./pages/Launched";
import { Privacy, Terms } from "./pages/Legal";
import { Pricing } from "./pages/Pricing";

export function App() {
  return (
    <>
      <DocumentMetadata />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/cli/authorize" element={<CliAuthorize />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/a/launched" element={<Launched />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
      </Routes>
    </>
  );
}

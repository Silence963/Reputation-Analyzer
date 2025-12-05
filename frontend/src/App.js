import React from "react";
import Dashboard from "./components/Dashboard";
import { CssBaseline, Container, Typography } from "@mui/material";

function App() {
  return (
    <>
      <CssBaseline />
      <Container maxWidth="md">
        <Typography variant="h3" align="center" gutterBottom sx={{ mt: 4 }}>
          REPA - Reputation Analysis Dashboard
        </Typography>
        <Dashboard />
      </Container>
    </>
  );
}

export default App; 
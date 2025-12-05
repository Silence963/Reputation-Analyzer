import React, { useState } from "react";
import { TextField, Button, Box } from "@mui/material";

export default function CompanySearch({ onSearch }) {
  const [companyId, setCompanyId] = useState("");

  return (
    <Box sx={{ 
      display: 'flex', 
      gap: { xs: 1, sm: 2 }, 
      alignItems: 'center', 
      mb: 2,
      flexDirection: { xs: 'column', sm: 'row' }
    }}>
      <TextField
        label="Company ID"
        value={companyId}
        onChange={e => setCompanyId(e.target.value)}
        size="small"
        helperText="Enter the company ID to analyze reviews"
        fullWidth
        sx={{ width: { xs: '100%', sm: 'auto' } }}
      />
      <Button
        variant="contained"
        onClick={() => onSearch(companyId)}
        disabled={!companyId}
        sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 160 } }}
      >
        Analyze Reviews
      </Button>
    </Box>
  );
} 
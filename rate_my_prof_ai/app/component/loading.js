import React from "react";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";

const Loading = ({ message = "Loading..." }) => {
  return (
    <Box
      sx={{
        position: "absolute",
        top: "50%",
        left: "50%",
      }}
    >
      <CircularProgress />
      <Box sx={{ mt: 2 }}>{message}</Box>
    </Box>
  );
};

export default Loading;

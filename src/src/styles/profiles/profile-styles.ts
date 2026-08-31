import "./profile-base.css";

// Vite includes every profileNN.css file automatically. Each file must scope
// its rules with the matching data-profile-template value.
import.meta.glob("./profile??.css", { eager: true });

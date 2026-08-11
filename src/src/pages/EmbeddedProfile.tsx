import { useEffect, useState } from "react";

import {
  fetchPublicWidgetConfiguration,
  ProfileApiError,
  PublicWidgetConfiguration,
} from "../lib/profile-api";
import { Profile } from "./Profile";

export function EmbeddedProfile({ publicKey }: { publicKey: string }) {
  const [configuration, setConfiguration] =
    useState<PublicWidgetConfiguration | null>(null);
  const [error, setError] = useState("");
  const language = navigator.language.toLowerCase().startsWith("en")
    ? "en"
    : "es";
  const copy =
    language === "en"
      ? {
          loading: "Loading chat...",
          unavailable: "This chat is not available right now.",
        }
      : {
          loading: "Cargando chat...",
          unavailable: "Este chat no está disponible en este momento.",
        };

  useEffect(() => {
    let active = true;

    fetchPublicWidgetConfiguration(publicKey)
      .then((nextConfiguration) => {
        if (active) {
          setConfiguration(nextConfiguration);
          setError("");
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof ProfileApiError && loadError.status !== 404
              ? loadError.message
              : copy.unavailable,
          );
        }
      });

    return () => {
      active = false;
    };
  }, [copy.unavailable, publicKey]);

  if (error) {
    return <div className="embedded-profile-state is-error">{error}</div>;
  }

  if (!configuration) {
    return <div className="embedded-profile-state">{copy.loading}</div>;
  }

  return (
    <Profile
      embedded
      profileAlias={configuration.profile.alias}
      onProfileNotFound={() => setError(copy.unavailable)}
    />
  );
}

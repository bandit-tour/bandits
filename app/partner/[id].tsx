import { Redirect, useLocalSearchParams, type Href } from "expo-router";
import React from "react";

/**
 * Legacy partner route — SmartTraveler places now live at `/localFind/[id]`.
 */
export default function PartnerDetailRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const href = (`/localFind/${id ?? ""}` as Href);
  return <Redirect href={href} />;
}

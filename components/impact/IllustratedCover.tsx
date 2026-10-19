import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from "react-native-svg";

/**
 * Original illustrated covers for Impact cards that have no licensed partner photo.
 * These are drawings, never a photograph of a different organization.
 */
export type CoverTheme = "shore" | "heritage" | "reading" | "volunteer" | "city";

export function themeForCopy(text: string): CoverTheme {
  const t = text.toLowerCase();
  if (/beach|shore|ocean|sea|coast|flisvos|phaleron|cleanup/.test(t)) return "shore";
  if (/agora|heritage|ancient|column|stone|artist/.test(t)) return "heritage";
  if (/read|school|book|studio|exarcheia|child/.test(t)) return "reading";
  if (/kitchen|meal|community|volunteer|helper/.test(t)) return "volunteer";
  return "city";
}

function safeId(seed: string, theme: string): string {
  const raw = `${theme}${seed}`.replace(/[^a-z0-9]/gi, "").slice(0, 24);
  return raw || theme;
}

export function IllustratedCover({ theme, seed }: { theme: CoverTheme; seed: string }) {
  const [box, setBox] = useState({ w: 360, h: 220 });
  const gid = safeId(seed, theme);
  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 8 && height > 8 && (width !== box.w || height !== box.h)) {
          setBox({ w: width, h: height });
        }
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={box.w} height={box.h} viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice">
        {theme === "shore" ? <Shore gid={gid} /> : null}
        {theme === "heritage" ? <Heritage gid={gid} /> : null}
        {theme === "reading" ? <Reading gid={gid} /> : null}
        {theme === "volunteer" ? <Volunteer gid={gid} /> : null}
        {theme === "city" ? <City gid={gid} /> : null}
      </Svg>
    </View>
  );
}

function Shore({ gid }: { gid: string }) {
  return (
    <>
      <Defs>
        <LinearGradient id={`${gid}sky`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#F8D7C4" />
          <Stop offset="1" stopColor="#E7A98A" />
        </LinearGradient>
        <LinearGradient id={`${gid}sand`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#F0D7A8" />
          <Stop offset="1" stopColor="#C99562" />
        </LinearGradient>
      </Defs>
      <Rect width="400" height="250" fill={`url(#${gid}sky)`} />
      <Circle cx="318" cy="58" r="36" fill="#F8E7C8" />
      <Circle cx="318" cy="58" r="22" fill="#F0C15A" />
      <Path d="M0 78 C70 96 110 48 180 64 C250 80 290 40 400 62 L400 0 L0 0 Z" fill="#F3C7B0" opacity={0.55} />
      <Path d="M0 128 C70 108 130 150 210 132 C290 114 330 154 400 136 L400 176 L0 176 Z" fill="#8E9C93" />
      <Path d="M0 156 C90 136 150 176 240 156 C320 138 350 170 400 154 L400 198 L0 198 Z" fill="#66756D" />
      <Path d="M0 178 C100 164 160 196 250 180 C330 166 360 188 400 176 L400 210 L0 210 Z" fill="#9AA79A" />
      <Rect y="188" width="400" height="62" fill={`url(#${gid}sand)`} />
      <Ellipse cx="62" cy="214" rx="22" ry="11" fill="#A67C52" />
      <Ellipse cx="148" cy="230" rx="30" ry="13" fill="#8C6240" />
      <Ellipse cx="246" cy="208" rx="16" ry="8" fill="#C4A06A" />
      <Ellipse cx="332" cy="226" rx="24" ry="12" fill="#96724C" />
      <Path d="M40 196 C48 184 58 184 66 196" stroke="#F7E7C8" strokeWidth="2" fill="none" />
    </>
  );
}

function Heritage({ gid }: { gid: string }) {
  return (
    <>
      <Defs>
        <LinearGradient id={`${gid}sky`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#F6E7D2" />
          <Stop offset="1" stopColor="#E4CDB0" />
        </LinearGradient>
      </Defs>
      <Rect width="400" height="250" fill={`url(#${gid}sky)`} />
      <Circle cx="330" cy="48" r="16" fill="#E7B15A" />
      <Path d="M36 168 L200 78 L364 168 Z" fill="#EFE4D2" />
      <Rect x="36" y="168" width="328" height="14" fill="#E7D7BE" />
      <Rect x="58" y="120" width="36" height="92" fill="#F4EBDD" />
      <Rect x="52" y="108" width="48" height="16" fill="#FFF8EE" />
      <Rect x="182" y="112" width="36" height="100" fill="#E7D9C4" />
      <Rect x="176" y="100" width="48" height="16" fill="#FFF8EE" />
      <Rect x="300" y="120" width="36" height="92" fill="#F4EBDD" />
      <Rect x="294" y="108" width="48" height="16" fill="#FFF8EE" />
      <Rect y="208" width="400" height="42" fill="#CDB892" />
      <Path d="M250 208 C258 176 286 176 294 208" fill="#6E8A62" />
      <Rect x="270" y="196" width="6" height="14" fill="#6B5344" />
    </>
  );
}

function Reading({ gid }: { gid: string }) {
  return (
    <>
      <Defs>
        <LinearGradient id={`${gid}wall`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#F7E6D4" />
          <Stop offset="1" stopColor="#E7CDB4" />
        </LinearGradient>
      </Defs>
      <Rect width="400" height="250" fill={`url(#${gid}wall)`} />
      <Rect x="36" y="36" width="150" height="110" rx="8" fill="#F6C56B" />
      <Rect x="48" y="48" width="126" height="86" rx="4" fill="#F8E2A8" />
      <Path d="M48 48 L111 92 L174 48" stroke="#E7B15A" strokeWidth="3" fill="none" />
      <Rect x="210" y="128" width="150" height="18" rx="3" fill="#F8F1E6" />
      <Rect x="210" y="150" width="150" height="18" rx="3" fill="#FFF8EE" />
      <Path d="M248 168 L286 168 L300 196 L234 196 Z" fill="#F7F1E6" />
      <Path d="M286 168 L324 168 L338 196 L300 196 Z" fill="#EFE4D4" />
      <Path d="M286 168 L286 196" stroke="#C9B49A" strokeWidth="2" />
      <Rect x="78" y="168" width="14" height="46" fill="#6B3A32" />
      <Ellipse cx="85" cy="160" rx="22" ry="10" fill="#E03131" />
      <Circle cx="85" cy="148" r="6" fill="#F0C15A" />
    </>
  );
}

function Volunteer({ gid }: { gid: string }) {
  return (
    <>
      <Defs>
        <LinearGradient id={`${gid}sky`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F3E6D4" />
          <Stop offset="1" stopColor="#E7D3B4" />
        </LinearGradient>
      </Defs>
      <Rect width="400" height="250" fill={`url(#${gid}sky)`} />
      <Circle cx="70" cy="56" r="18" fill="#F0C15A" />
      <Ellipse cx="200" cy="176" rx="120" ry="28" fill="#D7C4A4" />
      <Path d="M150 150 C150 108 250 108 250 150 L236 188 L164 188 Z" fill="#6E8A62" />
      <Path d="M164 120 C190 96 214 96 236 120" stroke="#F7F1E6" strokeWidth="8" fill="none" />
      <Circle cx="128" cy="118" r="22" fill="#F3C7A8" />
      <Circle cx="272" cy="118" r="22" fill="#E7B492" />
      <Path d="M108 132 C96 160 110 182 140 176" stroke="#F3C7A8" strokeWidth="16" fill="none" strokeLinecap="round" />
      <Path d="M292 132 C304 160 290 182 260 176" stroke="#E7B492" strokeWidth="16" fill="none" strokeLinecap="round" />
      <Rect x="168" y="96" width="64" height="10" rx="5" fill="#C99562" />
    </>
  );
}

function City({ gid }: { gid: string }) {
  return (
    <>
      <Defs>
        <LinearGradient id={`${gid}sky`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#F8E6D4" />
          <Stop offset="1" stopColor="#E8CDB4" />
        </LinearGradient>
      </Defs>
      <Rect width="400" height="250" fill={`url(#${gid}sky)`} />
      <Circle cx="64" cy="54" r="16" fill="#E7B15A" />
      <Rect x="40" y="120" width="70" height="90" fill="#E7D3BE" />
      <Rect x="48" y="132" width="16" height="18" fill="#F7F1E6" />
      <Rect x="74" y="132" width="16" height="18" fill="#F7F1E6" />
      <Rect x="130" y="88" width="90" height="122" fill="#F4E7D6" />
      <Rect x="146" y="104" width="18" height="22" fill="#C99562" />
      <Rect x="176" y="104" width="18" height="22" fill="#C99562" />
      <Rect x="146" y="140" width="18" height="22" fill="#E7B492" />
      <Rect x="176" y="140" width="18" height="22" fill="#E7B492" />
      <Rect x="240" y="132" width="64" height="78" fill="#DCC4A6" />
      <Path d="M300 210 C308 150 338 150 346 210" fill="#5E7A58" />
      <Rect x="320" y="196" width="6" height="16" fill="#6B5344" />
      <Rect y="208" width="400" height="42" fill="#CDB892" />
    </>
  );
}

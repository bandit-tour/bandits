/**
 * Native Mix / opening bottle clip.
 * Current bytes: 3D CGI message-in-bottle (not live ocean throw). See asset audit.
 */
export const BOTTLE_VIDEO = require('@/assets/images/local-friend-bottle.mov');
export const BOTTLE_POSTER = require('@/assets/images/brand/banditour-bottle-sky.png');

/**
 * Web submit / full-screen bottle throw (`BottleSubmitVideo.web` on Local Friend + bandiTeam report).
 * Bytes: PLAY hotel branding intro — preserve; do not repoint intro or submit flows to Mix loop.
 */
export const BOTTLE_VIDEO_WEB_URI = '/videos/play-intro.mp4' as const;

/**
 * Web Mix loading only (`TravelBottleMixLoading.web`) — H.264 re-wrap of `local-friend-bottle.mov`
 * (same family as native intro `BOTTLE_VIDEO`). Not PLAY branding; not live ocean throw.
 */
export const BOTTLE_MIX_VIDEO_WEB_URI = '/videos/bottle-mix-loop.mp4' as const;

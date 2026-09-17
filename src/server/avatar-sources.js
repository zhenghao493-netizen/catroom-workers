/**
 * Avatar assets are served from Workers Static Assets so the room UI does not
 * depend on third-party image hosts at play time.
 *
 * The Maodie photo is prototype-only artwork and is not covered by this
 * project's software license. See THIRD_PARTY_NOTICES.md.
 */
const LOCAL_AVATARS=[
  '/avatars/maodie-photo.png',
  '/avatars/maodie-photo.png',
  '/avatars/maodie-photo.png',
  '/avatars/3.svg',
  '/avatars/4.svg',
  '/avatars/5.svg'
];
export async function serveAvatar(request,env,ctx,index){
  const safe=Number.isInteger(index)&&index>=0&&index<LOCAL_AVATARS.length?index:0;
  return env.ASSETS.fetch(new Request(new URL(LOCAL_AVATARS[safe],request.url),request));
}

// Pages는 저장소 루트를 통째로 정적 파일로 올리기 때문에, 설정·DB 스키마 파일까지
// 주소만 알면 열립니다. _routes.json에 적은 경로만 여기로 들어오고(나머지 정적 파일은
// 함수를 거치지 않음), 그중 /api/ 가 아닌 것은 404로 막습니다.
export async function onRequest({ request, next }) {
  const path = new URL(request.url).pathname;
  if (path.startsWith('/api/')) return next();
  return new Response('Not found', { status: 404 });
}

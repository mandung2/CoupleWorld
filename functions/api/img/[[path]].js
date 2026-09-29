// /api/img/<폴더>/<uuid>.<확장자> — R2에 저장된 사진을 내려줍니다.
// 파일 이름이 바뀌지 않으므로(수정 시 새 이름으로 저장) 오래 캐시해도 안전합니다.
export async function onRequestGet({ env, params }) {
  const key = (params.path || []).join('/');
  if (!key) return new Response('Not found', { status: 404 });
  const obj = await env.PHOTOS.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
      ETag: obj.httpEtag,
      'Cache-Control': 'public, max-age=31536000, immutable',
      // 이미지로 선언된 파일을 브라우저가 다른 형식(HTML 등)으로 추측해 열지 않도록
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

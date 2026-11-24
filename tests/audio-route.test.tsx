import {beforeEach,expect,test,vi} from 'vitest';
import {GET} from '@/app/api/conversas/mensagens/[id]/audio/route';
import {administradorHttp} from '@/lib/auth/acesso-http';
import {effectiveSettings} from '@/lib/settings/repository';
import {audioDaConversa,respostaAudio} from '@/lib/atendimento/audio-conversa';
vi.mock('@/lib/auth/acesso-http',()=>({administradorHttp:vi.fn()}));
vi.mock('@/lib/db/client',()=>({db:vi.fn(()=>({}))}));
vi.mock('@/lib/settings/repository',()=>({effectiveSettings:vi.fn()}));
vi.mock('@/lib/atendimento/audio-conversa',()=>({audioDaConversa:vi.fn(),respostaAudio:vi.fn()}));
const id='4abdc7a2-4047-44f8-b254-624fdcdf5dd5';
beforeEach(()=>{vi.resetAllMocks();});
test('áudio exige sessão e permissão antes de consultar configurações ou provedor',async()=>{
 for(const status of [401,403] as const){vi.mocked(administradorHttp).mockResolvedValue({erro:status});const r=await GET(new Request('http://localhost/audio'),{params:Promise.resolve({id})});expect(r.status).toBe(status);}
 expect(administradorHttp).toHaveBeenCalledWith('operador');expect(effectiveSettings).not.toHaveBeenCalled();expect(audioDaConversa).not.toHaveBeenCalled();
});
test('áudio inexistente e falha do provedor não expõem detalhes ou credenciais',async()=>{
 vi.mocked(administradorHttp).mockResolvedValue({sessao:{userId:id,papel:'operador'}} as Awaited<ReturnType<typeof administradorHttp>>);
 vi.mocked(effectiveSettings).mockResolvedValue({});vi.mocked(audioDaConversa).mockResolvedValue(null);
 expect((await GET(new Request('http://localhost/audio'),{params:Promise.resolve({id})})).status).toBe(404);
 vi.mocked(audioDaConversa).mockRejectedValue(new Error('detalhe-privado-chave'));
 const r=await GET(new Request('http://localhost/audio'),{params:Promise.resolve({id})});expect(r.status).toBe(502);expect(await r.text()).not.toContain('detalhe-privado-chave');
});
test('range vai ao player autenticado sem aceitar URL de mídia do cliente',async()=>{
 vi.mocked(administradorHttp).mockResolvedValue({sessao:{userId:id,papel:'operador'}} as Awaited<ReturnType<typeof administradorHttp>>);
 vi.mocked(effectiveSettings).mockResolvedValue({});const audio={bytes:Buffer.from('OggS'),mime:'audio/ogg',extensao:'ogg'};vi.mocked(audioDaConversa).mockResolvedValue(audio);vi.mocked(respostaAudio).mockReturnValue(new Response('OggS',{status:206}));
 const r=await GET(new Request('http://localhost/audio?url=https://nao-acessar.invalid',{headers:{Range:'bytes=0-3'}}),{params:Promise.resolve({id})});
 expect(r.status).toBe(206);expect(respostaAudio).toHaveBeenCalledWith(audio,'bytes=0-3');
 expect(audioDaConversa).toHaveBeenCalledWith({},expect.objectContaining({papel:'operador'}),id,{});
});

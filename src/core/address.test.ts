import { describe, expect, it } from 'vitest';
import { normaliseAddress } from './address';

const url = (input: string) => normaliseAddress(input);

describe('normaliseAddress', () => {
  it('adds http and port 8123 when neither is typed', () => {
    expect(url('192.168.1.100')).toEqual({ ok: true, url: 'http://192.168.1.100:8123' });
  });
  it('keeps a typed port', () => {
    expect(url('homeassistant.local:8123')).toEqual({
      ok: true,
      url: 'http://homeassistant.local:8123',
    });
    expect(url('192.168.1.100:8080')).toEqual({ ok: true, url: 'http://192.168.1.100:8080' });
  });
  it('does not add 8123 when port 80 was typed, even though http addresses omit it', () => {
    expect(url('192.168.1.100:80')).toEqual({ ok: true, url: 'http://192.168.1.100' });
  });
  it('trims spaces and lower-cases the host', () => {
    expect(url('  HomeAssistant.LOCAL  ')).toEqual({
      ok: true,
      url: 'http://homeassistant.local:8123',
    });
  });
  it('does not add a port when the scheme was typed', () => {
    expect(url('http://192.168.1.100')).toEqual({ ok: true, url: 'http://192.168.1.100' });
    expect(url('https://example.ui.nabu.casa/')).toEqual({
      ok: true,
      url: 'https://example.ui.nabu.casa',
    });
  });
  it('drops any path, query and trailing slash', () => {
    expect(url('http://192.168.1.100:8123/lovelace/0?x=1')).toEqual({
      ok: true,
      url: 'http://192.168.1.100:8123',
    });
  });
  it('reports empty input', () => {
    expect(url('')).toEqual({ ok: false, reason: 'empty' });
    expect(url('   ')).toEqual({ ok: false, reason: 'empty' });
  });
  it('reports input that is not an http or https address', () => {
    for (const bad of ['http://', 'a b', 'ftp://host', 'ht!tp://x']) {
      expect(url(bad)).toEqual({ ok: false, reason: 'invalid' });
    }
  });
});

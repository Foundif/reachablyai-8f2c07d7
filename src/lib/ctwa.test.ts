import { describe, it, expect } from 'vitest';
import { classifyReferral } from './ctwa';

describe('classifyReferral', () => {
  it('Instagram ad link counts as Instagram', () => {
    expect(classifyReferral({ source_type: 'ad', source_url: 'https://www.instagram.com/p/abc' })).toBe('instagram');
  });
  it('Facebook ad without Instagram link counts as Facebook Ads', () => {
    expect(classifyReferral({ source_type: 'ad', source_url: 'https://fb.me/xyz' })).toBe('facebook_ads');
  });
  it('Facebook post counts as Facebook Post', () => {
    expect(classifyReferral({ source_type: 'post', source_url: 'https://www.facebook.com/123' })).toBe('facebook_post');
  });
  it('unknown referral counts as Others', () => {
    expect(classifyReferral({})).toBe('others');
  });
});

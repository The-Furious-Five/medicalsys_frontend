import { TestBed } from '@angular/core/testing';
import { HomePage } from './home-page';

describe('HomePage', () => {
  it('should present the six steps of the MVP flow', async () => {
    await TestBed.configureTestingModule({ imports: [HomePage] }).compileComponents();

    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('.flow-card');
    expect(cards).toHaveLength(6);
  });
});

/**
 * Long-form site content. These are DRAFTS prepared for review by a lawyer
 * before launch (spec §84); they are content, not UI strings, so they live
 * here rather than in the translation catalogs.
 */
export interface ContentPage {
  title: string;
  description: string;
  updated: string;
  sections: Array<{ heading: string; body: string[] }>;
}

export const PAGES: Record<string, ContentPage> = {
  about: {
    title: 'About Bulava',
    description: 'Bulava helps families and planners invite, organise and celebrate, beautifully and privately.',
    updated: '2026-09-27',
    sections: [
      {
        heading: 'Why we built Bulava',
        body: [
          'Indian celebrations are rarely a single event. A wedding can span Haldi, Mehendi, Sangeet, Baraat, the ceremony and a reception, each with a different guest list. Printed cards cannot change after they are sent, and forwarded videos cannot tell you who is coming.',
          'Bulava gives every guest their own invitation, showing only the functions they are invited to, in their language, with RSVP, directions, updates and a shared photo gallery.',
        ],
      },
      {
        heading: 'For every celebration',
        body: [
          'Weddings are where we started, but the same platform powers birthdays, anniversaries, godh bharai, namkaran, mundan, griha pravesh, pujas, festivals, school events and corporate gatherings.',
        ],
      },
    ],
  },
  contact: {
    title: 'Contact us',
    description: 'Get help with your event, billing or partnerships.',
    updated: '2026-09-27',
    sections: [
      { heading: 'Support', body: ['Email support@bulava.in with your event name and we will reply within one working day.'] },
      { heading: 'Planners and agencies', body: ['Interested in the Studio plan for your clients? Write to partners@bulava.in.'] },
      { heading: 'Privacy requests', body: ['To access, export or delete your data, use Account settings or write to privacy@bulava.in.'] },
    ],
  },
  privacy: {
    title: 'Privacy policy',
    description: 'How Bulava collects, uses and protects personal data.',
    updated: '2026-09-27',
    sections: [
      {
        heading: 'Draft notice',
        body: ['This policy is a draft pending legal review for compliance with India’s Digital Personal Data Protection Act, 2023 and other applicable laws.'],
      },
      {
        heading: 'Data we process',
        body: [
          'Hosts: name, email, phone (optional), payment records and the event details you enter.',
          'Guests: the details a host adds (name, and optionally phone, email and address), RSVP responses and photos a guest chooses to upload.',
          'Technical data: IP address and device information for security, rate limiting and audit logs.',
        ],
      },
      {
        heading: 'How we use it',
        body: [
          'To deliver invitations, RSVPs, galleries and notifications that hosts request; to secure accounts; to process payments through Razorpay; and, where configured, to measure product usage in aggregate.',
          'We do not sell personal data. Guest data is used only for the event it was added to.',
        ],
      },
      {
        heading: 'Security',
        body: [
          'Invitation links use secret, revocable tokens. Photos are stored privately and served only through short-lived signed links. Photo metadata such as GPS location is removed during processing.',
        ],
      },
      {
        heading: 'Your choices',
        body: [
          'You can export your data or delete your account at any time from Account settings. Hosts can delete guests, photos and events; deleted events stop working immediately.',
        ],
      },
    ],
  },
  terms: {
    title: 'Terms of service',
    description: 'The terms that govern use of Bulava.',
    updated: '2026-09-27',
    sections: [
      { heading: 'Draft notice', body: ['These terms are a draft pending legal review.'] },
      {
        heading: 'Your content',
        body: [
          'You are responsible for the content you publish and must have the right to use any photos, text or music you upload. Only licensed music provided by Bulava may be used in video invitations.',
        ],
      },
      {
        heading: 'Acceptable use',
        body: ['Do not use Bulava to send spam, collect personal data without consent, or share unlawful content. We may suspend accounts that do.'],
      },
      { heading: 'Payments', body: ['Paid plans are one-time purchases per event unless stated otherwise. See the refund policy for details.'] },
    ],
  },
  refund: {
    title: 'Refund policy',
    description: 'When and how refunds are issued.',
    updated: '2026-09-27',
    sections: [
      { heading: 'Draft notice', body: ['This policy is a draft pending review.'] },
      {
        heading: 'Event upgrades',
        body: [
          'If you have not yet shared any invitation for the upgraded event, you may request a full refund within 7 days of purchase.',
          'Once invitations have been opened by guests, upgrades are non-refundable, except where required by law.',
        ],
      },
      { heading: 'How refunds are paid', body: ['Approved refunds are returned to the original payment method through Razorpay, typically within 5–7 working days.'] },
    ],
  },
};

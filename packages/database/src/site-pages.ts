import type { PrismaClient } from '../generated/client';

/**
 * The built-in site pages: About, Contact and the policies. Seeded once as
 * published rows (`system`), then edited in the admin console (Pages); later
 * seeds never overwrite them. Text uses the page markup in
 * @bulava/validation/pages: blank lines between paragraphs, "### " sub-headings,
 * "- " lists, **bold**, [links](/page) and {placeholders} filled from the site
 * settings. A paragraph whose placeholder has no value yet (say {legalName}
 * before the company details are entered) is left out until it has one.
 */
export interface SeedSitePage {
  slug: string;
  title: string;
  description: string;
  layout: 'DOCUMENT' | 'CARDS' | 'CONTACT';
  footerGroup: 'COMPANY' | 'LEGAL';
  sortOrder: number;
  sections: Array<{ heading: string; body: string }>;
}

/** Lets the text below be indented like the code around it. */
const text = (s: string) =>
  s
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .join('\n');

export const SITE_PAGES: SeedSitePage[] = [
  // ───────────────────────────── About ─────────────────────────────
  {
    slug: 'about',
    title: 'About Bulava',
    description: 'We make invitations the way Indian families actually celebrate: many functions, many guest lists, one beautiful link for every guest.',
    layout: 'CARDS',
    footerGroup: 'COMPANY',
    sortOrder: 0,
    sections: [
      {
        heading: 'Why Bulava exists',
        body: text(`
          Our celebrations are rarely one event. A wedding can be a Haldi in the morning, a Mehendi that evening, a Sangeet, the pheras and a reception, each with its own guest list, venue and dress code.

          Printed cards can't change once they are posted. A PDF forwarded on WhatsApp can't tell you who is coming, and the family group ends up answering the same question about the venue fifty times.

          Bulava gives every guest one link that opens a beautiful invitation with exactly the functions they are invited to, along with directions, timings, RSVP and updates.
        `),
      },
      {
        heading: 'What you can do with it',
        body: text(`
          - **Invitation websites** that look hand-made and work like an app.
          - **Video invitations and digital cards** in the same design, ready for WhatsApp.
          - **Guest lists and RSVPs** for each function, with reminders.
          - **A shared photo album** with a QR code, so every guest's photos land in one place.
          - **Event-day tools**: QR check-in, seating, and travel and stay details for guests.
        `),
      },
      {
        heading: 'For every celebration',
        body: text(`
          Weddings are where we started. Today families also use Bulava for engagements, birthdays, anniversaries, godh bharai, naamkaran, mundan, griha pravesh, pujas, festival get-togethers, school functions and office events.

          Our designs are made for Hindu, Sikh, Muslim, Christian, South Indian, Bengali, Marathi, Gujarati and Punjabi celebrations, and for anyone who wants something entirely their own.
        `),
      },
      {
        heading: 'Private by design',
        body: text(`
          A guest list is family business. Each guest gets a private link that shows only their functions. Photos are stored privately, and the location data hidden inside phone photos is removed when they are uploaded.

          We never sell personal data and we never show ads to your guests. You can download or delete your data whenever you like.
        `),
      },
      {
        heading: 'How we work',
        body: text(`
          - **Design comes first.** Every template is drawn for Indian celebrations and checked to be easy to read on any phone.
          - **Pricing is fair.** Start free and pay once for an event only when you need more. Prices include GST, with no hidden charges.
          - **People answer support.** Write to us and a real person replies, usually within one working day.
        `),
      },
      {
        heading: 'Say hello',
        body: text(`
          Questions, ideas, or a story about how Bulava helped your family? Write to {supportEmail} or use our [contact form](/contact).

          Wedding planners, venues and agencies who want Bulava for their clients can ask us about the Studio plan.

          Bulava is operated by {legalName}.
        `),
      },
    ],
  },

  // ───────────────────────────── Contact ─────────────────────────────
  {
    slug: 'contact',
    title: 'Contact us',
    description: 'A question about your invitation, a payment or your data? Send us a message and a real person will reply, usually within one working day.',
    layout: 'CONTACT',
    footerGroup: 'COMPANY',
    sortOrder: 1,
    sections: [
      {
        heading: 'Get a faster answer',
        body: text(`
          Write from the email address on your Bulava account and tell us your event's name, so we can find it straight away.

          For a payment, include the Razorpay payment ID from your confirmation. It starts with "pay_".
        `),
      },
      {
        heading: 'When we reply',
        body: text(`
          We answer most messages within one working day.

          If your event is today or tomorrow, say so at the start of your message and we will look at it first.
        `),
      },
      {
        heading: 'Your privacy and data',
        body: text(`
          To see, correct, download or delete your data, choose "Privacy and my data" in the form. You can also download your data or delete your account yourself from Account settings.

          Our [privacy policy](/privacy) explains your rights in full.
        `),
      },
      {
        heading: 'Complaints',
        body: text(`
          If we haven't solved a problem, or you want to report content on Bulava, write to {supportEmail} with "Grievance" at the start of the subject. We acknowledge complaints within 24 hours and resolve them within 15 days.

          Our Grievance Officer is {grievanceOfficer}.

          Our [grievance redressal page](/grievance-redressal) explains the process and where to go next.
        `),
      },
      {
        heading: 'Our office',
        body: text(`
          {legalName}

          {address}

          Phone: {supportPhone}
        `),
      },
    ],
  },

  // ───────────────────────────── Privacy ─────────────────────────────
  {
    slug: 'privacy',
    title: 'Privacy policy',
    description: 'What personal data we collect, why, on what legal basis, who we share it with, how long we keep it, and how to use your rights under Indian law.',
    layout: 'DOCUMENT',
    footerGroup: 'LEGAL',
    sortOrder: 0,
    sections: [
      {
        heading: 'The short version',
        body: text(`
          - We collect only what we need to run your invitations, and we tell you exactly what and why below.
          - We ask for your consent with a box you tick yourself, and we record which version of this policy you agreed to.
          - We never sell personal data, and we never show ads to your guests.
          - Guests' details are used only for the event they were added to.
          - Photos are stored privately, and location data is removed from them.
          - You can see, correct, download or delete your data at any time. A deleted account can be restored for 30 days, then it is erased.

          This summary is not the whole policy. The sections below give the details.
        `),
      },
      {
        heading: 'Who we are and which laws apply',
        body: text(`
          Bulava (bulava.in) is a service for digital invitations, RSVPs and event photo sharing. In this policy, "Bulava", "we" and "us" mean the business that runs it, and "you" means anyone who uses it: hosts who create events, the team members they invite, and guests who receive invitations.

          Bulava is operated by {legalName}, {address}.

          We process personal data under India's Digital Personal Data Protection Act, 2023 and the Digital Personal Data Protection Rules, 2025 (together, the "DPDP Act"), and the Information Technology Act, 2000 with the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011.

          Under the DPDP Act, you are the "Data Principal" and we are the "Data Fiduciary" for your account and for how the service works. When a host adds guests, the host decides whose details to add and why, and we use those details only to deliver that host's event.
        `),
      },
      {
        heading: 'What we collect',
        body: text(`
          ### When you create an account
          Your name, email address and password. The password is "sensitive personal data" under the IT Rules: we store it only as a secure one-way hash that nobody can read. If you sign in with Google, we receive your name, email address and a Google account ID, never your Google password. You may add a phone number.

          ### When you plan an event
          What you enter: event and function details, venues and dates, your guest list (names and, if you add them, phone numbers, email addresses, households and notes), RSVP questions, travel, stay and seating details, photos, music choices and messages to guests.

          ### When you are a guest
          The details your host entered about you, your RSVP and answers, any travel details you add, photos you upload to the event album, and whether you opened your invitation. If an invitation asks you to confirm a one-time code, we send it to the email address or phone number your host gave us.

          ### When you register for a public event
          The details you type into the registration form, and your agreement to share them with the host.

          ### When you pay
          The plan you bought, the amount, your agreement to the purchase terms, and the order and payment references from Razorpay. Card, UPI and bank details are financial information, which is sensitive personal data: you enter them only on Razorpay's secure checkout, and we never see or store them.

          ### When you contact us
          Your name, email address, phone number if you give it, your message and our replies.

          ### Automatically
          Your IP address, browser and device type, and the pages and actions you use, which we need for security, to stop abuse and to understand how Bulava is used. Our [cookie policy](/cookies) explains the cookies involved.
        `),
      },
      {
        heading: 'Why we use it, and on what basis',
        body: text(`
          We use personal data only for these specified purposes:

          - **To provide the service you asked for**: create events, deliver invitations by link, email or WhatsApp, collect RSVPs, run photo albums and check-in, and send the reminders and updates a host schedules. Basis: your consent.
          - **To create and protect your account**, including sign-in, two-step verification and spotting misuse. Basis: your consent, and our duty to keep data secure.
          - **To take payments and make refunds**, and to keep the records tax law requires. Basis: your consent to the purchase, and compliance with law.
          - **To answer your messages** and support requests. Basis: you gave us the data for that purpose (a "legitimate use" under section 7 of the DPDP Act).
          - **To improve Bulava**, using combined statistics wherever possible. Basis: your consent.
          - **To meet legal obligations**, such as tax records, and to answer lawful requests from courts and authorities. Basis: compliance with law.

          We don't sell personal data, build advertising profiles from it, or show ads to guests. We never use a guest's details to market Bulava to that guest. We don't use your data for any new purpose without telling you and, where the law requires it, asking again.
        `),
      },
      {
        heading: 'Your consent',
        body: text(`
          We ask for consent clearly and separately: when you create an account you tick a box to accept our Terms of Service and this Privacy Policy, and when you buy a plan you tick a box to accept the Terms and the Refund and Cancellation Policy. These boxes are never ticked for you. We record each consent with its date and the version of the policy you saw.

          You can withdraw your consent at any time, as easily as you gave it: delete your account from Account settings, or write to {supportEmail}. Withdrawing consent doesn't affect anything done before, and we then stop processing your data, except what the law requires us to keep (see "How long we keep it"). Withdrawing may mean we can no longer provide the service.

          Once Consent Managers registered with the Data Protection Board of India are available, you may also give, manage and withdraw your consent through one of them.
        `),
      },
      {
        heading: 'Guests and the host’s responsibility',
        body: text(`
          When you add guests, you share their details with us. Please add only people you are really inviting, add only the details needed to invite them, and remove anyone who asks. Send invitations by WhatsApp or email only to people who would expect to hear from you.

          If you are a guest and want your details changed or removed, ask your host, or write to {supportEmail} and we will help.
        `),
      },
      {
        heading: 'Children',
        body: text(`
          Bulava accounts are only for adults aged 18 or over. We don't knowingly create accounts for children.

          A host may add a child's name to a guest list, for example for a family function. Do so only as, or with the verifiable consent of, the child's parent or lawful guardian. We use a child's details only to deliver that invitation. We never track or monitor the behaviour of children, and never show them targeted advertising.
        `),
      },
      {
        heading: 'Who we share it with',
        body: text(`
          We share personal data only with the people and services needed to run Bulava:

          - **The host and their team.** A guest's RSVP, answers, travel details and uploaded photos are visible to the host and to the team members the host adds, according to each member's role.
          - **Other guests**, but only what the host chooses to show, such as approved photos in the album or on the live photo wall.
          - **Data Processors** that work for us under written contracts and may use the data only on our instructions: cloud hosting, file storage (Cloudflare), email delivery, WhatsApp messages (Meta's WhatsApp Business Platform), payments (Razorpay), sign-in with Google, maps on invitations (Google Maps), error monitoring, and analytics on our public website.
          - **Authorities**, when the law requires it, for example an order of a court or a lawful request from an authorised government agency.
          - **A buyer or successor**, if Bulava is sold or merged, who must protect the data as this policy does.

          You can ask us for the list of the Data Processors and other Data Fiduciaries we have shared your data with. We never sell or rent personal data.
        `),
      },
      {
        heading: 'Where your data is stored',
        body: text(`
          Bulava runs on servers operated by our hosting providers. Some of them, including our file storage, may keep data in data centres outside India.

          We transfer personal data outside India only to countries the Government of India has not restricted under section 16 of the DPDP Act, and only to providers bound to protect it as this policy requires.
        `),
      },
      {
        heading: 'How long we keep it',
        body: text(`
          We keep personal data only as long as it is needed for the purpose you gave it for, or as the law requires, and then erase it.

          - **Your account**: until you delete it. You then have 30 days to change your mind and restore it by signing in. After 30 days we erase your name, contact details and sign-in methods for good. Our [account deletion policy](/account-deletion) explains each step.
          - **Events, guest lists, RSVPs, photos and videos**: until the host deletes them or their account. A deleted event is erased permanently, with its photos and videos, 30 days later.
          - **Payment and invoice records**: as long as tax and accounting laws require, currently up to eight years, kept without your contact details once your account is erased.
          - **Records of your consent**: for as long as we need to show what you agreed to.
          - **Messages to support**: up to two years after the conversation ends. Spam is deleted within 30 days.
          - **Security and access logs**: at least one year, as the DPDP Rules require, to detect and investigate misuse.

          Deleted data also disappears from our encrypted backups as they are replaced over the following weeks.
        `),
      },
      {
        heading: 'How we protect it',
        body: text(`
          We follow reasonable security practices and procedures, as the IT Act and the DPDP Act require:

          - Every connection to Bulava is encrypted (HTTPS), and sensitive values such as sign-in secrets are encrypted at rest.
          - Passwords are stored only as salted hashes. Invitation links use long random keys that hosts can revoke or replace.
          - Photos and videos are stored privately and shown only through short-lived links after a permission check. Location and camera details are removed from photos when they are uploaded.
          - Payment details never reach our servers; payments are handled by Razorpay, a PCI-DSS compliant payment gateway.
          - Staff access is limited by role and needs two-step sign-in. Access and security events are logged and reviewed, and we keep backups to restore data if something goes wrong.

          No system is perfectly secure, and you help by keeping your password private.
        `),
      },
      {
        heading: 'If there is a data breach',
        body: text(`
          If a breach affects your personal data, we will tell you without delay: what happened, what it may mean for you, what we are doing about it, and what you can do to protect yourself.

          We will also report it to the Data Protection Board of India, with a detailed report within 72 hours of becoming aware of it, as the DPDP Rules require, and to CERT-In where the law requires.
        `),
      },
      {
        heading: 'Your rights',
        body: text(`
          Under the DPDP Act you have the right to:

          - **access information**: a summary of your personal data we process and how, and who we have shared it with;
          - **correction, completion, updating and erasure** of your personal data;
          - **grievance redressal**: a quick and fair answer to complaints about how we handle your data;
          - **nominate** someone to use these rights for you if you die or become unable to;
          - **withdraw consent** at any time (see "Your consent").

          Much of this you can do yourself: edit your profile and events, download your data, or delete your account from Account settings. For anything else, write to {supportEmail} with "Privacy" in the subject, or use our [contact form](/contact). We may ask you to confirm who you are, and we answer within 30 days, usually much sooner.

          You also have duties under section 15 of the Act: give accurate information, don't impersonate anyone, and don't file false or frivolous complaints.
        `),
      },
      {
        heading: 'Complaints',
        body: text(`
          If you have a concern about how we handle your personal data, please contact our Grievance Officer first. Our [grievance redressal page](/grievance-redressal) explains how and how quickly we respond.

          If you are not satisfied with our answer, you may complain to the Data Protection Board of India, as provided under the DPDP Act.
        `),
      },
      {
        heading: 'Cookies',
        body: text(`
          We use a few cookies to keep you signed in and to make invitations work and, on our public website only, analytics. Our [cookie policy](/cookies) lists them all.
        `),
      },
      {
        heading: 'Changes to this policy',
        body: text(`
          When we change this policy, we update the date at the top of this page. If a change is significant, we tell account holders by email or in the app before it takes effect, and where the law requires it we ask for your consent again.
        `),
      },
      {
        heading: 'Contact and Grievance Officer',
        body: text(`
          For anything about your privacy, write to {supportEmail} with "Privacy" in the subject, or use our [contact form](/contact) and choose "Privacy and my data".

          Grievance Officer: {grievanceOfficer}, reachable at {supportEmail}.

          Postal address: {legalName}, {address}.

          Phone: {supportPhone}

          We acknowledge grievances within 24 hours and resolve them within 15 days.
        `),
      },
    ],
  },

  // ───────────────────────────── Terms ─────────────────────────────
  {
    slug: 'terms',
    title: 'Terms of service',
    description: 'The agreement between you and Bulava when you use our website, dashboard and invitations. Please read it before you create an event or buy a plan.',
    layout: 'DOCUMENT',
    footerGroup: 'LEGAL',
    sortOrder: 1,
    sections: [
      {
        heading: 'About these terms',
        body: text(`
          These terms are an agreement between you and Bulava ("we", "us"). They apply when you use bulava.in, the Bulava dashboard, invitations and event pages made with Bulava, and any related service (together, the "Service"). They are an electronic record under the Information Technology Act, 2000, and need no physical or digital signature.

          By ticking the box to accept them when you create an account or buy a plan, you agree to these terms and to our [privacy policy](/privacy), [refund and cancellation policy](/refund), [shipping and delivery policy](/shipping) and [cookie policy](/cookies). If you don't agree, please don't use the Service.

          Guests who only open an invitation, reply to it or upload photos accept the parts of these terms that apply to them: the rules on content and acceptable use, and the limits of our liability.
        `),
      },
      {
        heading: 'Who we are',
        body: text(`
          The Service is provided by {legalName}.

          Registered office: {address}.

          Customer care: {supportEmail}

          Phone: {supportPhone}

          Grievance Officer: {grievanceOfficer}

          Our [grievance redressal page](/grievance-redressal) explains how to raise a complaint and how quickly we respond.
        `),
      },
      {
        heading: 'Who can use Bulava',
        body: text(`
          To create an account you must be at least 18 years old and able to enter a binding contract under the Indian Contract Act, 1872.

          If you use Bulava for a business, such as a planning agency or a venue, you confirm that you are allowed to accept these terms for it.
        `),
      },
      {
        heading: 'Your account',
        body: text(`
          - Give accurate details and keep them up to date.
          - Keep your password private. You are responsible for what happens in your account.
          - Team members you add to an event work within your event. You choose their role and can remove them at any time.
          - Tell us at {supportEmail} straight away if you think someone else has used your account.
        `),
      },
      {
        heading: 'Using the Service',
        body: text(`
          Bulava lets you design invitations, share them with guests, collect RSVPs, share photos and run your event. We improve the Service all the time, so features may be added, changed or removed.

          We give reasonable notice before removing a feature you rely on, and we never reduce what a plan you have already paid for includes for that event.
        `),
      },
      {
        heading: 'Your content and your guests',
        body: text(`
          You own what you put on Bulava: text, photos, guest lists and messages. You give us a limited licence to store, copy, show and process that content only to run the Service for you, for example to show your invitation to your guests, make your video and keep backups. The licence ends when you delete the content, apart from copies we keep for the periods in our privacy policy.

          You confirm that:

          - you have the right to use everything you upload, including photos of other people;
          - you have a genuine reason to contact the guests you add, and you will stop contacting anyone who asks you to;
          - you will send WhatsApp messages and emails through Bulava only to people who expect to hear from you.

          You are responsible for your event's content and guest list. As an intermediary under the IT Act, we don't review content before it is published, but we act on complaints and on lawful orders.
        `),
      },
      {
        heading: 'Acceptable use',
        body: text(`
          As the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 require, you must not use Bulava to host, show, upload, change, publish, share or send anything that:

          - belongs to someone else and you have no right to use;
          - is obscene, pornographic or paedophilic, invades anyone's bodily privacy, or is harmful to children;
          - is defamatory, invades anyone's privacy, insults or harasses anyone on the basis of gender, is racially or ethnically objectionable, or promotes enmity between groups on grounds of religion or caste with intent to incite violence;
          - relates to or encourages money laundering or gambling;
          - infringes a patent, trademark, copyright or any other right;
          - misleads people about where a message comes from, or knowingly spreads false or misleading information;
          - impersonates another person;
          - threatens the unity, integrity, defence, security or sovereignty of India, its friendly relations with other countries or public order, incites any cognisable offence, prevents the investigation of an offence, or insults another nation;
          - contains viruses or any other harmful code;
          - breaks any law in force in India.

          You also must not send spam or messages people didn't ask for, create fake events to collect money or personal data, try to get around our security or overload our systems, or copy, scrape or resell the Service or our templates without our written permission.

          If you break these rules, we may remove the content and suspend or close your account. We report unlawful content where the law requires.
        `),
      },
      {
        heading: 'Complaints about content and lawful orders',
        body: text(`
          Anyone can report content that breaks these terms to our Grievance Officer, as our [grievance redressal page](/grievance-redressal) explains. We acknowledge complaints within 24 hours and resolve them within 15 days. If content shows a person's private areas, or shows them in a sexual act or in the nude, or is an impersonation in such a form, we act on the complaint within 24 hours.

          We remove or disable access to content when a court orders it, or when an authorised government agency notifies us under the IT Act, within the time the law sets. When we remove content, we keep it and the related records for 180 days, or longer if a court or authority asks, so that it can be investigated.

          If you disagree with a decision our Grievance Officer makes about content, you may appeal to the Grievance Appellate Committee set up by the Government of India, within 30 days of the decision.
        `),
      },
      {
        heading: 'Templates, music and our rights',
        body: text(`
          Bulava's designs, templates, illustrations, music, software and brand belong to us or to the artists who license them to us.

          When you use a template or a music track, you get a personal, non-transferable right to use it in the invitations, videos and cards you make on Bulava for your event. You may share what you make with your guests and on social media. You may not sell it, reuse the designs elsewhere, or extract the artwork or music.

          Only music from Bulava's library can be used in video invitations.
        `),
      },
      {
        heading: 'Plans, prices and payments',
        body: text(`
          - The Free plan costs nothing. Paid plans and everything they include are listed on our [pricing page](/pricing), in Indian rupees, inclusive of GST. There are no hidden charges.
          - Event plans, such as Standard and Premium, are one-time payments that upgrade one event.
          - Yearly plans, such as Studio, give access for 12 months from payment and do not renew automatically.
          - You pay on Razorpay's secure checkout by UPI, credit or debit card, net banking or wallet. Bulava never sees or stores your card or bank details.
          - We record your agreement to a purchase only through your own tick of the unticked box at checkout. A plan starts once the payment is confirmed.
          - A change of price applies only to new purchases.
          - If you need a GST invoice, write to {supportEmail} with your order details.

          Refunds and cancellations follow our [refund and cancellation policy](/refund), and delivery follows our [shipping and delivery policy](/shipping). If something is wrong with a payment, please contact us before raising a chargeback with your bank.
        `),
      },
      {
        heading: 'Services from other companies',
        body: text(`
          Parts of the Service rely on other companies: Razorpay for payments, Meta for WhatsApp messages, Google for sign-in and maps, and email providers for delivery. Their own terms apply when you use them.

          We are not responsible for their outages or decisions, for example WhatsApp declining to deliver a message.
        `),
      },
      {
        heading: 'Availability',
        body: text(`
          We work hard to keep Bulava running, but we can't promise it will always be available or free of errors. We may pause the Service for maintenance, at quiet times and with notice whenever we can.

          Keep your own copy of anything important. You can export your guest list and download your data at any time.
        `),
      },
      {
        heading: 'Deleting your account',
        body: text(`
          You can delete your account at any time from Account settings. Your events go offline at once, and you have 30 days to change your mind by signing in and restoring the account. After that, the account and its events are erased for good, except the records the law requires us to keep. Our [account deletion policy](/account-deletion) explains each step.

          We may suspend or close an account, or take down an event, if it breaks these terms or the law, puts other people at risk, or if the law requires us to. Where we can, we tell you why and give you a chance to respond. If we close your account without a good reason under these terms, we refund the unused part of any paid plan.
        `),
      },
      {
        heading: 'Disclaimers',
        body: text(`
          We provide the Service "as is" and "as available". As far as the law allows, we make no promises beyond those in these terms. In particular, we can't guarantee that every invitation is delivered or read: email and WhatsApp delivery depends on networks and services we don't control.

          Nothing in these terms takes away your rights under the Consumer Protection Act, 2019, the Consumer Protection (E-Commerce) Rules, 2020, or any other law that can't be excluded by contract.
        `),
      },
      {
        heading: 'Limits of our liability',
        body: text(`
          As far as the law allows, we are not liable for indirect or consequential losses, such as lost profits, goodwill or data, or the cost of other services.

          Our total liability for any claim connected with the Service is limited to what you paid us in the 12 months before the claim, or ₹1,000 if you haven't paid us anything.

          These limits don't apply where the law doesn't allow them, for example in cases of fraud or gross negligence.
        `),
      },
      {
        heading: 'Indemnity',
        body: text(`
          If someone makes a claim against us because of content you uploaded, a message you sent through Bulava, or your breach of these terms or the law, you agree to cover the reasonable costs and losses that result.
        `),
      },
      {
        heading: 'Law and disputes',
        body: text(`
          These terms are governed by the laws of India.

          If something goes wrong, please contact us first. Most problems are solved quickly that way. If we can't settle a dispute together, the courts with jurisdiction over our registered office will decide it. Nothing here stops you from approaching a Consumer Disputes Redressal Commission, or the National Consumer Helpline, as the law allows.
        `),
      },
      {
        heading: 'Changes to these terms',
        body: text(`
          We may update these terms. We change the date at the top of this page and tell you in advance about important changes. If you keep using Bulava after a change takes effect, the new terms apply; if you don't agree with them, you can delete your account.
        `),
      },
    ],
  },

  // ───────────────────────────── Refunds ─────────────────────────────
  {
    slug: 'refund',
    title: 'Refund and cancellation policy',
    description: 'When you can cancel a purchase and get your money back, how to ask, and how long it takes.',
    layout: 'DOCUMENT',
    footerGroup: 'LEGAL',
    sortOrder: 2,
    sections: [
      {
        heading: 'The short version',
        body: text(`
          - Changed your mind? Ask within 7 days of paying, before any guest has opened that event's invitation, and you get a full refund.
          - Charged twice, or charged for a payment that failed? We refund it in full.
          - Refunds go back to the way you paid, through Razorpay, usually within 5 to 7 working days of approval.
        `),
      },
      {
        heading: 'Cancelling a purchase',
        body: text(`
          Everything Bulava sells is digital and starts working as soon as you pay. You cancel a purchase by asking for a refund under the rules below. We never charge a cancellation fee.

          Deleting an event or your account doesn't cancel a purchase or start a refund by itself.
        `),
      },
      {
        heading: 'Event plans (Standard and Premium)',
        body: text(`
          You get a full refund if both of these are true:

          - you ask within 7 days of the payment; and
          - no guest has opened an invitation or the event page for the upgraded event, and no video invitation or card has been made with the plan.

          After that the plan counts as used and can't be refunded, except as described under "When something goes wrong".
        `),
      },
      {
        heading: 'Yearly plans (Studio)',
        body: text(`
          You get a full refund within 7 days of payment if you haven't yet used the plan for an event that guests have opened.

          After that, yearly plans can't be refunded, and you keep access until the end of the 12 months. Yearly plans never renew automatically, so there is nothing to cancel at the end of the year.
        `),
      },
      {
        heading: 'When something goes wrong',
        body: text(`
          We refund you in full, at any time, if:

          - you were charged more than once for the same purchase;
          - money left your account but the payment failed or the plan wasn't applied, and we can't fix it within 2 working days;
          - a fault on our side stopped you from using what you paid for, and we couldn't fix it in time for your event.

          If a fault affected only part of what you paid for, we may offer a partial refund instead. A payment that failed at the bank's end is reversed by your bank automatically, within the timelines the Reserve Bank of India sets for failed digital payments.
        `),
      },
      {
        heading: 'What can’t be refunded',
        body: text(`
          - Plans past the 7-day window, or already used as described above.
          - Complimentary upgrades, and purchases made entirely with a coupon, because nothing was paid. If a coupon covered part of the price, a refund covers only the amount you paid.
          - Charges from your bank or card issuer, such as currency conversion fees.
        `),
      },
      {
        heading: 'How to ask for a refund',
        body: text(`
          Write to {supportEmail} from the email address on your Bulava account, or use our [contact form](/contact) and choose "Payments and refunds". Please include:

          - the name of the event;
          - the date and amount of the payment;
          - the Razorpay payment ID, which starts with "pay_" and is in your payment confirmation.

          We reply within 2 working days, and start an approved refund straight away.
        `),
      },
      {
        heading: 'How long refunds take',
        body: text(`
          Approved refunds are paid back to the original payment method through Razorpay. Most arrive within 5 to 7 working days; some banks take up to 10.

          When a refund is made, the plan's features end for that event or account.
        `),
      },
      {
        heading: 'Payment disputes',
        body: text(`
          If something is wrong with a payment, please talk to us before raising a dispute with your bank. Disputes take weeks, and we can usually sort things out in a day or two.
        `),
      },
      {
        heading: 'Your rights',
        body: text(`
          This policy doesn't affect your rights under the Consumer Protection Act, 2019. For questions about it, write to {supportEmail}.
        `),
      },
    ],
  },

  // ───────────────────────────── Shipping and delivery ─────────────────────────────
  {
    slug: 'shipping',
    title: 'Shipping and delivery policy',
    description: 'Bulava sells digital services only. This is how and when you receive what you buy.',
    layout: 'DOCUMENT',
    footerGroup: 'LEGAL',
    sortOrder: 3,
    sections: [
      {
        heading: 'Nothing is shipped',
        body: text(`
          Bulava's plans, templates, invitation websites, video invitations and digital cards are all digital. We don't ship physical products, and there are no shipping or handling charges.
        `),
      },
      {
        heading: 'When a plan starts',
        body: text(`
          A plan is applied to your event, or to your account for yearly plans, as soon as Razorpay confirms the payment. That usually takes a few seconds, and you will see the plan in your dashboard.

          If you paid but the plan doesn't appear within 30 minutes, refresh the page. If it is still missing, write to {supportEmail} with your Razorpay payment ID and we will sort it out.
        `),
      },
      {
        heading: 'Video invitations and cards',
        body: text(`
          Videos and cards are made on our servers when you ask for them. Most are ready within a few minutes, though it can take longer at busy times. Your dashboard shows when each one is ready to download and share.
        `),
      },
      {
        heading: 'Invitations to your guests',
        body: text(`
          Invitations reach guests when you send or share them: as links you share yourself, or by email or WhatsApp sent through Bulava.

          Email and WhatsApp delivery depends on your guests' providers and networks, so we can't guarantee that every message arrives. Your dashboard shows each invitation's status, and you can always share the link directly.
        `),
      },
      {
        heading: 'Where we deliver',
        body: text(`
          Bulava works online in India and abroad. Guests anywhere in the world can open your invitations. Prices are in Indian rupees.
        `),
      },
      {
        heading: 'If something doesn’t arrive',
        body: text(`
          If something you paid for hasn't been delivered within 24 hours, write to {supportEmail}. We will fix it or refund you under our [refund and cancellation policy](/refund).
        `),
      },
    ],
  },

  // ───────────────────────────── Cookies ─────────────────────────────
  {
    slug: 'cookies',
    title: 'Cookie policy',
    description: 'The small files and browser storage Bulava uses, what each one does, and how you can control them.',
    layout: 'DOCUMENT',
    footerGroup: 'LEGAL',
    sortOrder: 4,
    sections: [
      {
        heading: 'What cookies are',
        body: text(`
          Cookies are small text files a website saves in your browser. Browser storage works in a similar way. We use as few of either as we can, and none of them for advertising inside the Service.
        `),
      },
      {
        heading: 'Cookies that keep Bulava working',
        body: text(`
          These are needed for signing in and for opening protected invitations, so they can't be switched off.

          - **bulava_at** keeps you signed in. It lasts 15 minutes and is renewed while you use Bulava.
          - **bulava_rt** renews your sign-in securely. It lasts up to 30 days, or until you sign out.
          - **bulava_session** tells our pages that you are signed in. It holds no personal data and lasts as long as your sign-in.
          - **bulava_google_state** protects "Continue with Google" against forgery. It lasts 10 minutes.
          - **bulava_otp** remembers that you confirmed an invitation with a one-time code, so you don't need a new code on every visit. It lasts 30 days.
          - **bulava_pin_…** remembers that you entered an event's PIN. It lasts 12 hours.
          - **bulava_link_…** keeps the key of a private event link, so it doesn't stay in your address bar. It lasts 90 days.
          - **bulava_invite** (browser storage) remembers your invitation while you upload photos, and is cleared when you close the tab.
        `),
      },
      {
        heading: 'Analytics on our public website',
        body: text(`
          On our public pages, such as the home, templates and pricing pages, we may use analytics and ad-measurement tools to understand how people find and use Bulava. Depending on what we have switched on, these can include Google Analytics and Google Tag Manager, Google Ads, Meta Pixel, Microsoft Clarity, LinkedIn Insight Tag and PostHog. They set their own cookies, such as _ga, _gcl_au, _fbp, _clck and ph_….

          These tools never run in your dashboard, on invitations, on our contact form, or on any page that shows event or guest details.
        `),
      },
      {
        heading: 'Maps on invitations',
        body: text(`
          An invitation can show a Google Map of the venue. When the map loads, Google may set its own cookies under Google's privacy policy.
        `),
      },
      {
        heading: 'Your choices',
        body: text(`
          You can block or delete cookies in your browser's settings. If you block the cookies that keep Bulava working, you won't be able to sign in or open protected invitations. Blocking analytics cookies doesn't change how Bulava works for you.
        `),
      },
      {
        heading: 'Changes and questions',
        body: text(`
          We update this page whenever we add or remove a cookie. If you have a question, write to {supportEmail}.
        `),
      },
    ],
  },

  // ───────────────────────────── Account deletion ─────────────────────────────
  {
    slug: 'account-deletion',
    title: 'Account deletion policy',
    description: 'How to delete your Bulava account, how to change your mind within 30 days, and exactly what is erased and what the law requires us to keep.',
    layout: 'DOCUMENT',
    footerGroup: 'LEGAL',
    sortOrder: 5,
    sections: [
      {
        heading: 'The short version',
        body: text(`
          - You can delete your account yourself, at any time, from Account settings.
          - Your events go offline straight away.
          - You have 30 days to change your mind: sign in and choose "Restore my account".
          - After 30 days your account and its events are erased for good.
          - We keep only the payment records that tax law requires, without your contact details.
        `),
      },
      {
        heading: 'How to delete your account',
        body: text(`
          1. Sign in and open **Account settings** from the menu at the top right.
          2. Under **Delete my account**, read what will happen and choose **Delete my account**.
          3. Confirm with your password. If you sign in only with Google, type DELETE instead.

          You are signed out on every device, and we email you the date your account will be erased.

          If you can't sign in, write to {supportEmail} from the email address on your account. We will check that the request is really yours before acting on it.
        `),
      },
      {
        heading: 'The 30 days to change your mind',
        body: text(`
          For 30 days after you delete your account:

          - your events are offline: guests can't open their invitations, photo albums or event pages, and no reminders or messages are sent;
          - nothing is erased yet, so nothing is lost if you come back;
          - you can restore everything by signing in with your password or Google and choosing **Restore my account**.

          Restoring brings back your account and every event that went offline with it, as they were.
        `),
      },
      {
        heading: 'What is erased after 30 days',
        body: text(`
          - Your name, email address, phone number, password and sign-in methods, including Google and two-step verification.
          - The events you own, with their functions, guest lists, RSVPs, travel and seating details, photos, videos and messages.
          - Your places on other people's event teams, your notifications and your active sessions.

          Photos and videos are deleted from our storage, and the data disappears from our encrypted backups as they are replaced over the following weeks. We email you once the erasure is done.
        `),
      },
      {
        heading: 'What we have to keep',
        body: text(`
          Some records must be kept by law even after an account is deleted. We keep them only for as long as required and only for that purpose, linked to an anonymous account number instead of your name or contact details:

          - **Payment and invoice records**, as tax and accounting laws require, currently up to eight years;
          - **Records of the consents** you gave, to show what you agreed to;
          - **Security and access logs**, for at least one year, as the DPDP Rules require.
        `),
      },
      {
        heading: 'Guests and team members',
        body: text(`
          If you are a guest, there is no account to delete: ask the host to remove you from their guest list, or write to {supportEmail} and we will help.

          If you are on someone else's event team, deleting your account removes you from the team. The photos you uploaded to their album stay with their event.
        `),
      },
      {
        heading: 'Paid plans',
        body: text(`
          Deleting your account doesn't cancel a purchase or start a refund by itself. If you are still within the refund window, ask for a refund before you delete your account, as our [refund and cancellation policy](/refund) explains.
        `),
      },
      {
        heading: 'Questions',
        body: text(`
          Write to {supportEmail}, or see our [privacy policy](/privacy) and [grievance redressal](/grievance-redressal) page.
        `),
      },
    ],
  },

  // ───────────────────────────── Grievance redressal ─────────────────────────────
  {
    slug: 'grievance-redressal',
    title: 'Grievance redressal',
    description: 'How to raise a complaint about Bulava, content on it or your personal data, who handles it, how quickly we respond, and where to go next.',
    layout: 'DOCUMENT',
    footerGroup: 'LEGAL',
    sortOrder: 6,
    sections: [
      {
        heading: 'Our commitment',
        body: text(`
          We want every complaint to be heard and settled quickly and fairly. This page sets out our grievance redressal mechanism under the Information Technology Act, 2000 and the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, the Consumer Protection (E-Commerce) Rules, 2020, and the Digital Personal Data Protection Act, 2023.
        `),
      },
      {
        heading: 'Grievance Officer',
        body: text(`
          Name and designation: {grievanceOfficer}

          Email: {supportEmail}

          Phone: {supportPhone}

          Address: {legalName}, {address}

          Write with "Grievance" at the start of the subject, or use our [contact form](/contact).
        `),
      },
      {
        heading: 'What to include',
        body: text(`
          - Your name and how we can reach you.
          - What your complaint is about: the Service, a payment, content on Bulava, or your personal data.
          - For content: a link to it, or the event's name, and why you are reporting it.
          - For a payment: the Razorpay payment ID, which starts with "pay_".
          - Any documents that help us understand the problem.
        `),
      },
      {
        heading: 'How quickly we respond',
        body: text(`
          - We **acknowledge** every complaint within 24 hours, with a reference number.
          - We **resolve** complaints within 15 days, and tell you the outcome and the reasons for it.
          - Requests to remove content that breaks our [acceptable use rules](/terms) are resolved within 72 hours.
          - Content that shows a person's private areas, shows them in full or partial nudity or in a sexual act, or impersonates them in such a form, including morphed images, is removed or disabled within 24 hours of the complaint.
          - Requests to use your rights over your personal data are answered within 30 days.
        `),
      },
      {
        heading: 'If you are not satisfied',
        body: text(`
          You can take your complaint further:

          - **About content decisions**: appeal to the Grievance Appellate Committee set up by the Government of India, within 30 days of our decision, at https://gac.gov.in.
          - **As a consumer**: contact the National Consumer Helpline on 1915 or 1800-11-4000, or at https://consumerhelpline.gov.in, or file a complaint with the Consumer Disputes Redressal Commission through https://edaakhil.nic.in.
          - **About your personal data**: complain to the Data Protection Board of India, as provided under the DPDP Act.
        `),
      },
      {
        heading: 'Other ways to reach us',
        body: text(`
          For everyday questions, our [contact page](/contact) is the fastest way to reach our team. Our [terms of service](/terms) and [privacy policy](/privacy) explain your rights in full.
        `),
      },
    ],
  },
];

/** Creates any built-in page that doesn't exist yet. Pages edited in the console are never touched. */
export async function seedSitePages(prisma: PrismaClient): Promise<number> {
  let created = 0;
  for (const page of SITE_PAGES) {
    const existing = await prisma.sitePage.findUnique({ where: { slug: page.slug }, select: { id: true } });
    if (existing) continue;
    await prisma.sitePage.create({ data: { ...page, status: 'PUBLISHED', system: true, publishedAt: new Date() } });
    created++;
  }
  return created;
}

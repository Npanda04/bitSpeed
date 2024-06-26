import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

app.post('/identify', async (req: Request, res: Response) => {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    return res.status(400).json({ error: 'Either email or phoneNumber must be provided.' });
  }

  // Find contacts by email or phone number
  const contacts = await prisma.contact.findMany({
    where: {
      OR: [
        { email: email ?? undefined },
        { phoneNumber: phoneNumber ?? undefined },
      ],
    },
  });

  if (contacts.length === 0) {
    // No contacts found, create a new primary contact
    const newContact = await prisma.contact.create({
      data: {
        email,
        phoneNumber,
        linkPrecedence: 'primary',
      },
    });

    return res.json({
      contact: {
        primaryContactId: newContact.id,
        emails: [newContact.email].filter(Boolean),
        phoneNumbers: [newContact.phoneNumber].filter(Boolean),
        secondaryContactIds: [],
      },
    });
  }

  // Determine the primary contact
  let primaryContact = contacts.find(contact => contact.linkPrecedence === 'primary') || contacts[0];
  let secondaryContacts = contacts.filter(contact => contact.id !== primaryContact.id);

  // If the incoming request contains new information, create a new secondary contact
  const existingEmail = contacts.some(contact => contact.email === email);
  const existingPhoneNumber = contacts.some(contact => contact.phoneNumber === phoneNumber);

  if ((email && !existingEmail) || (phoneNumber && !existingPhoneNumber)) {
    const newSecondaryContact = await prisma.contact.create({
      data: {
        email,
        phoneNumber,
        linkedId: primaryContact.id,
        linkPrecedence: 'secondary',
      },
    });

    secondaryContacts.push(newSecondaryContact);
  }

  // Fetch all related contacts using a join approach
  const allRelatedContacts = await prisma.contact.findMany({
    where: {
      OR: [
        { id: primaryContact.id },
        { linkedId: primaryContact.id },
        { linkedId: { in: secondaryContacts.map(sc => sc.id) } },
      ],
    },
  });

  // Collect all emails and phone numbers
  const emails = Array.from(new Set(allRelatedContacts.map(contact => contact.email).filter(Boolean)));
  const phoneNumbers = Array.from(new Set(allRelatedContacts.map(contact => contact.phoneNumber).filter(Boolean)));

  // Collect secondary contact IDs
  const secondaryContactIds = allRelatedContacts
    .filter(contact => contact.linkPrecedence === 'secondary')
    .map(contact => contact.id);

  // Respond with the consolidated contact information
  return res.json({
    contact: {
      primaryContactId: primaryContact.id,
      emails,
      phoneNumbers,
      secondaryContactIds,
    },
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});




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


});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});




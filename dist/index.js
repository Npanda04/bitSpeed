"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
app.use(express_1.default.json());
app.post('/identify', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, phoneNumber } = req.body;
    if (!email && !phoneNumber) {
        return res.status(400).json({ error: 'Either email or phoneNumber must be provided.' });
    }
    // Find contacts by email or phone number
    const contacts = yield prisma.contact.findMany({
        where: {
            OR: [
                { email: email !== null && email !== void 0 ? email : undefined },
                { phoneNumber: phoneNumber !== null && phoneNumber !== void 0 ? phoneNumber : undefined },
            ],
        },
    });
    if (contacts.length === 0) {
        // No contacts found, create a new primary contact
        const newContact = yield prisma.contact.create({
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
        const newSecondaryContact = yield prisma.contact.create({
            data: {
                email,
                phoneNumber,
                linkedId: primaryContact.id,
                linkPrecedence: 'secondary',
            },
        });
        secondaryContacts.push(newSecondaryContact);
    }
    // Fetch all related contacts using a recursive approach
    const fetchAllRelatedContacts = (primaryContactId) => __awaiter(void 0, void 0, void 0, function* () {
        let queue = [primaryContactId];
        let visited = new Set();
        while (queue.length > 0) {
            const currentId = queue.shift();
            if (!currentId || visited.has(currentId))
                continue;
            visited.add(currentId);
            const relatedContacts = yield prisma.contact.findMany({
                where: {
                    OR: [
                        { id: currentId },
                        { linkedId: currentId },
                        { id: { in: Array.from(visited) } },
                        { linkedId: { in: Array.from(visited) } },
                    ],
                },
            });
            for (const contact of relatedContacts) {
                if (!visited.has(contact.id)) {
                    queue.push(contact.id);
                }
            }
        }
        return Array.from(visited);
    });
    const allRelatedContactIds = yield fetchAllRelatedContacts(primaryContact.id);
    const allRelatedContacts = yield prisma.contact.findMany({
        where: {
            id: { in: allRelatedContactIds },
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
}));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

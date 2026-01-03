import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { HelpCircle, Mail, Phone, MessageCircle } from 'lucide-react';

const faqs = [
  {
    question: 'How do I book a parking slot?',
    answer: 'Navigate to "Book Parking" from the sidebar, select your vehicle, choose a parking zone, pick your date and time, and confirm your booking. You\'ll receive a booking code that you can use at the entry gate.',
  },
  {
    question: 'How do I add a new vehicle?',
    answer: 'Go to "My Vehicles" from the sidebar and click "Add Vehicle". Fill in the vehicle details including registration number, type, make, model, and color.',
  },
  {
    question: 'What payment methods are accepted?',
    answer: 'We accept UPI, credit/debit cards, and net banking. You can also use your campus card if linked to your account.',
  },
  {
    question: 'Can I cancel a booking?',
    answer: 'Yes, you can cancel a booking up to 30 minutes before the scheduled start time. Go to your booking history and select the booking you want to cancel.',
  },
  {
    question: 'What if I forget my booking code?',
    answer: 'You can find all your booking codes in the "History" section. You can also check your email for the booking confirmation.',
  },
  {
    question: 'How do I extend my parking duration?',
    answer: 'Currently, you need to create a new booking for additional time. We\'re working on an extend feature that will be available soon.',
  },
];

const Help = () => {
  return (
    <AppLayout title="Help & Support">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <HelpCircle className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground mb-2">
            How can we help you?
          </h2>
          <p className="text-muted-foreground">
            Find answers to common questions or contact our support team
          </p>
        </div>

        {/* Contact Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card className="text-center">
            <CardContent className="py-6">
              <Mail className="w-8 h-8 mx-auto text-primary mb-3" />
              <h3 className="font-semibold mb-1">Email Support</h3>
              <p className="text-sm text-muted-foreground">parking@vit.ac.in</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="py-6">
              <Phone className="w-8 h-8 mx-auto text-primary mb-3" />
              <h3 className="font-semibold mb-1">Phone Support</h3>
              <p className="text-sm text-muted-foreground">+91 416 220 2020</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="py-6">
              <MessageCircle className="w-8 h-8 mx-auto text-primary mb-3" />
              <h3 className="font-semibold mb-1">Live Chat</h3>
              <p className="text-sm text-muted-foreground">Available 9 AM - 6 PM</p>
            </CardContent>
          </Card>
        </div>

        {/* FAQs */}
        <Card>
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Help;
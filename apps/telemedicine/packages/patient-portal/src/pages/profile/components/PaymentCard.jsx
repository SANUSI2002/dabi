import React from "react";
import { Button } from "design-system";
import { SectionCard, TextField } from "../shared";
import { PAYMENT } from "../data";

export function PaymentCard() {
  return (
    <SectionCard icon="💳" title="Payment">
      <TextField label="CARD DETAILS" defaultValue={PAYMENT.cardNumber} uppercaseLabel />
      <div className="sabi-field-row">
        <TextField label="EXP DATE" defaultValue={PAYMENT.expDate} uppercaseLabel />
        <Button variant="outline" className="sabi-payment-update">
          Update Payment Method
        </Button>
      </div>
    </SectionCard>
  );
}

export default PaymentCard;

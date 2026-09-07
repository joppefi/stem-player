import React from "react";

type FieldProps = {
  label: string;
  value: string | number | undefined;
};

function Field({ label, value }: FieldProps) {
  return (
    <div>
      <label>{label}</label>
      <p>{value}</p>
    </div>
  );
}

export default Field;

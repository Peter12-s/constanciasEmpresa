import { Text } from "@mantine/core";
import { BasicPetition } from "../core/petition";
import { validateCourses } from "../lib/validator";
import { useEffect } from "react";

export function Test() {

  async function fetchData() {
    try {
      const certificates: any = await BasicPetition({
        endpoint: "/certificate",
        method: "GET",
      });

      const valid = await validateCourses(
        certificates[0],
        "2001-01-11",
        "2001-01-11"
      );
      

      console.log(valid,'NO VALIDOS');
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    fetchData();
  }, []); // ← solo una vez al montar

  return <Text>FUNCIONAAAA XD</Text>;
}

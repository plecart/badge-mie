import { describe, expect, it } from "vitest";
import { CMAKE_ARGUMENT, addCmakeArgument } from "./with-cmake-object-path-max";

/** Un `app/build.gradle` réduit à ce que le plugin lit : le bloc `defaultConfig`. */
const GRADLE = `android {
    defaultConfig {
        versionCode 2
    }
}
`;

describe("le plugin CMAKE_OBJECT_PATH_MAX", () => {
  it("ajoute l'argument CMake au bloc defaultConfig", () => {
    const gradle = addCmakeArgument(GRADLE);
    expect(gradle).toMatch(
      /defaultConfig \{\s+externalNativeBuild \{ cmake \{ arguments "-DCMAKE_OBJECT_PATH_MAX=250" \} \}/,
    );
    expect(gradle).toContain("versionCode 2");
  });

  it("ne l'ajoute qu'une fois", () => {
    const once = addCmakeArgument(GRADLE);
    expect(addCmakeArgument(once)).toBe(once);
    expect(once.split(CMAKE_ARGUMENT)).toHaveLength(2);
  });

  it("lève sur un build.gradle sans bloc defaultConfig", () => {
    expect(() => addCmakeArgument("android {}\n")).toThrow(/defaultConfig/);
  });
});

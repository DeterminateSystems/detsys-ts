{
  description = "Development environment for detsys-ts";

  inputs = {
    flake-schemas.url = "https://flakehub.com/f/DeterminateSystems/flake-schemas/0.1";
    nixpkgs.url = "https://flakehub.com/f/NixOS/nixpkgs/0.1";
  };

  outputs =
    {
      self,
      ...
    }@inputs:
    let
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forEachSupportedSystem =
        f:
        inputs.nixpkgs.lib.genAttrs supportedSystems (
          system:
          f {
            pkgs = import inputs.nixpkgs { inherit system; };
          }
        );
    in
    {
      inherit (inputs.flake-schemas) schemas;

      formatter = forEachSupportedSystem ({ pkgs }: pkgs.nixfmt-rfc-style);

      devShells = forEachSupportedSystem (
        { pkgs }:
        {
          default = pkgs.mkShellNoCC {
            packages = with pkgs; [
              nodejs_latest
              nodePackages_latest.pnpm
              nixpkgs-fmt
            ];
          };
        }
      );
    };
}

{
  description = "Super Mega Lucky Box development environment";
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };
  outputs = { nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let pkgs = import nixpkgs { inherit system; };
      in {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [ nodejs_24 bun git jdk21 gh python3 ripgrep openssl ];
          shellHook = ''
            export JAVA_HOME="${pkgs.jdk21}"
            export XDG_CACHE_HOME="$PWD/.firebase/cache"
          '';
        };
      });
}
